'use client';

import { Room, RoomEvent, type RemoteParticipant, type LocalParticipant } from 'livekit-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { isVoiceEnabled } from '@/lib/hooks/use-voice-enabled';
import { getVoiceSocket } from '@/lib/realtime/socket';
import type { VoiceJoinEnvelope } from './types';

/**
 * Singleton LiveKit Room manager that survives page navigation. The
 * voice room IS the call — joining is a Room.connect, leaving is a
 * Room.disconnect. The provider holds the active Room in a ref, exposes
 * imperative actions (joinChannel / leaveChannel / toggleMute) and a
 * reactive view (state) for UI to render against.
 *
 * Discord-style single-room invariant: clicking a different voice
 * channel auto-disconnects from the previous one. The backend
 * /voice/channels/:id/join endpoint also closes any prior server-side
 * participant rows for the user — both sides enforce it.
 */

export type VoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface VoiceParticipantView {
  identity: string; // userId
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
}

export interface VoiceState {
  connectionState: VoiceConnectionState;
  /** The Atlas channel id (NOT the LiveKit room name). null when idle. */
  channelId: string | null;
  /** Pretty channel name for the persistent panel. */
  channelName: string | null;
  /** Project the channel belongs to (null for lobby). */
  projectId: string | null;
  /** Live participant roster — keyed by userId/identity. */
  participants: Map<string, VoiceParticipantView>;
  /** Local user's mic-mute state. */
  micMuted: boolean;
  /** Latency in ms (round-trip to LiveKit signaling). null until connected. */
  ping: number | null;
  /** Error message if connectionState === 'error'. */
  error: string | null;
}

export interface VoiceActions {
  joinChannel: (channelId: string, opts?: { projectId?: string | null }) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
}

const VoiceContext = createContext<{ state: VoiceState; actions: VoiceActions } | null>(null);

const initialState: VoiceState = {
  connectionState: 'idle',
  channelId: null,
  channelName: null,
  projectId: null,
  participants: new Map(),
  micMuted: false,
  ping: null,
  error: null,
};

export function VoiceProvider({ children }: { children: ReactNode }) {
  const enabled = isVoiceEnabled();
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<VoiceState>(initialState);

  // Stable setter helpers — wrapped so we don't churn renderers.
  const patch = useCallback((partial: Partial<VoiceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const buildParticipantView = useCallback(
    (p: RemoteParticipant | LocalParticipant): VoiceParticipantView => {
      // LiveKit metadata is a JSON string we set at JWT mint time.
      let avatarUrl: string | null = null;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata) as { avatarUrl?: string };
          avatarUrl = meta.avatarUrl ?? null;
        }
      } catch {
        // ignore malformed metadata
      }
      return {
        identity: p.identity,
        name: p.name ?? p.identity,
        avatarUrl,
        isLocal: 'localTrackPublications' in p,
        isSpeaking: p.isSpeaking,
        audioLevel: p.audioLevel,
        isMuted: p.isMicrophoneEnabled === false,
      };
    },
    [],
  );

  const refreshParticipants = useCallback(
    (room: Room) => {
      const map = new Map<string, VoiceParticipantView>();
      map.set(room.localParticipant.identity, buildParticipantView(room.localParticipant));
      for (const p of room.remoteParticipants.values()) {
        map.set(p.identity, buildParticipantView(p));
      }
      setState((prev) => ({ ...prev, participants: map }));
    },
    [buildParticipantView],
  );

  const teardownRoom = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    roomRef.current = null;
    try {
      await room.disconnect();
    } catch {
      // ignore — best-effort
    }
  }, []);

  const joinChannel = useCallback<VoiceActions['joinChannel']>(
    async (channelId, opts) => {
      if (!enabled) return;
      // Single-room invariant: drop the previous room before connecting.
      if (roomRef.current) {
        await teardownRoom();
      }
      patch({
        connectionState: 'connecting',
        channelId,
        projectId: opts?.projectId ?? null,
        channelName: null,
        error: null,
        participants: new Map(),
        ping: null,
      });

      let envelope: VoiceJoinEnvelope;
      try {
        envelope = await api<VoiceJoinEnvelope>(apiPaths.voice.join(channelId), {
          method: 'POST',
        });
      } catch (err) {
        patch({
          connectionState: 'error',
          error: (err as Error).message ?? 'Failed to join voice channel.',
        });
        return;
      }
      if (!envelope.url || !envelope.token) {
        patch({ connectionState: 'error', error: 'Voice service is unavailable.' });
        return;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          audioPreset: { maxBitrate: 64_000 }, // STANDARD-quality default
        },
      });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, () => refreshParticipants(room))
        .on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room))
        .on(RoomEvent.ActiveSpeakersChanged, () => refreshParticipants(room))
        .on(RoomEvent.TrackMuted, () => refreshParticipants(room))
        .on(RoomEvent.TrackUnmuted, () => refreshParticipants(room))
        .on(RoomEvent.LocalTrackPublished, () => refreshParticipants(room))
        .on(RoomEvent.Reconnecting, () => patch({ connectionState: 'reconnecting' }))
        .on(RoomEvent.Reconnected, () => patch({ connectionState: 'connected' }))
        .on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) {
            roomRef.current = null;
            setState(initialState);
          }
        });

      try {
        await room.connect(envelope.url, envelope.token);
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (err) {
        roomRef.current = null;
        patch({
          connectionState: 'error',
          error: (err as Error).message ?? 'Failed to connect to voice.',
        });
        return;
      }

      patch({
        connectionState: 'connected',
        channelName: envelope.channel.name,
        micMuted: false,
      });
      refreshParticipants(room);

      // Subscribe to the channel's metadata socket so the persistent
      // panel + sidebar roster stay live even after the LiveKit Room
      // closes (e.g., on transient signaling drops).
      const socket = getVoiceSocket();
      if (socket && socket.connected) {
        socket.emit('voice:subscribe.channel', { channelId });
      }
    },
    [enabled, patch, refreshParticipants, teardownRoom],
  );

  const leaveChannel = useCallback<VoiceActions['leaveChannel']>(async () => {
    const channelId = state.channelId;
    await teardownRoom();
    setState(initialState);
    if (channelId) {
      try {
        await api(apiPaths.voice.leave(channelId), { method: 'POST' });
      } catch {
        // The webhook reconciler will catch this if it failed.
      }
      const socket = getVoiceSocket();
      socket?.emit('voice:unsubscribe.channel', { channelId });
    }
  }, [state.channelId, teardownRoom]);

  const toggleMute = useCallback<VoiceActions['toggleMute']>(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !state.micMuted ? false : true;
    await room.localParticipant.setMicrophoneEnabled(next);
    patch({ micMuted: !next });
  }, [patch, state.micMuted]);

  // Disconnect cleanly on tab close.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void teardownRoom();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, teardownRoom]);

  const actions = useMemo<VoiceActions>(
    () => ({ joinChannel, leaveChannel, toggleMute }),
    [joinChannel, leaveChannel, toggleMute],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider.');
  return ctx;
}

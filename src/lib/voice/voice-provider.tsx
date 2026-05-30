'use client';

import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
  type LocalVideoTrack,
  type RemoteAudioTrack,
  type LocalAudioTrack,
} from 'livekit-client';
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
import type {
  VoiceJoinEnvelope,
  VoiceUserPreferences,
  VoiceUserPreferencesPatch,
} from './types';

/**
 * Singleton LiveKit Room manager. Survives navigation; one Room at a
 * time per tab (Discord-style single-room invariant). UI consumes the
 * reactive `state` and calls imperative `actions`.
 *
 * Phase 2 adds: camera + screen-share, per-participant video track
 * refs, mic/cam device pickers, deafen, and a spotlightParticipantId
 * the layout uses to pick the big tile.
 */

export type VoiceConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/** Video / screen-share quality presets baked into the publish call. */
export type ScreenShareQuality = '720p30' | '1080p30' | '1080p60';

export interface VoiceParticipantView {
  identity: string; // userId
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  /** LiveKit camera VideoTrack reference (opaque to consumers). */
  cameraTrack: RemoteVideoTrack | LocalVideoTrack | null;
  /** Screen-share video track. */
  screenShareTrack: RemoteVideoTrack | LocalVideoTrack | null;
  /** Screen-share audio (browser tab capture audio) — Chromium only. */
  screenShareAudioTrack: RemoteAudioTrack | LocalAudioTrack | null;
}

export interface VoiceDeviceList {
  mics: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
}

export interface VoiceState {
  connectionState: VoiceConnectionState;
  channelId: string | null;
  channelName: string | null;
  projectId: string | null;
  participants: Map<string, VoiceParticipantView>;
  micMuted: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  /** True when the user has chosen to mute incoming audio (also mutes mic). */
  deafened: boolean;
  /** Currently-selected input device IDs (null = system default). */
  micDeviceId: string | null;
  cameraDeviceId: string | null;
  devices: VoiceDeviceList;
  /** Which participant's tile is enlarged. Defaults to whoever is sharing screen. */
  spotlightIdentity: string | null;
  /** True while the PTT key is held (only meaningful in PUSH_TO_TALK mode). */
  pttActive: boolean;
  /** Persisted prefs from the backend. null until first GET resolves. */
  preferences: VoiceUserPreferences | null;
  ping: number | null;
  error: string | null;
}

export interface VoiceActions {
  joinChannel: (channelId: string, opts?: { projectId?: string | null }) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleCamera: (deviceId?: string) => Promise<void>;
  toggleScreenShare: (quality?: ScreenShareQuality, audio?: boolean) => Promise<void>;
  toggleDeafen: () => Promise<void>;
  switchMicDevice: (deviceId: string) => Promise<void>;
  switchCameraDevice: (deviceId: string) => Promise<void>;
  switchOutputDevice: (deviceId: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
  setSpotlight: (identity: string | null) => void;
  /** Load (or reload) the user's preferences from the backend. */
  loadPreferences: () => Promise<void>;
  /** Persist a partial preferences update. Optimistic; rolls back on failure. */
  updatePreferences: (patch: VoiceUserPreferencesPatch) => Promise<void>;
}

const VoiceContext = createContext<{ state: VoiceState; actions: VoiceActions } | null>(null);

const initialState: VoiceState = {
  connectionState: 'idle',
  channelId: null,
  channelName: null,
  projectId: null,
  participants: new Map(),
  micMuted: false,
  cameraEnabled: false,
  screenSharing: false,
  deafened: false,
  micDeviceId: null,
  cameraDeviceId: null,
  devices: { mics: [], cameras: [], outputs: [] },
  spotlightIdentity: null,
  pttActive: false,
  preferences: null,
  ping: null,
  error: null,
};

// Map our ScreenShareQuality preset to LiveKit's track resolution.
const SCREEN_SHARE_PRESETS: Record<
  ScreenShareQuality,
  { maxBitrate: number; maxFramerate: number; width: number; height: number }
> = {
  '720p30': { width: 1280, height: 720, maxFramerate: 30, maxBitrate: 1_500_000 },
  '1080p30': { width: 1920, height: 1080, maxFramerate: 30, maxBitrate: 3_000_000 },
  '1080p60': { width: 1920, height: 1080, maxFramerate: 60, maxBitrate: 6_000_000 },
};

function pickPublicationVideoTrack(
  pub: RemoteTrackPublication | LocalTrackPublication | undefined,
): RemoteVideoTrack | LocalVideoTrack | null {
  if (!pub || !pub.track) return null;
  return pub.track.kind === Track.Kind.Video
    ? (pub.track as RemoteVideoTrack | LocalVideoTrack)
    : null;
}

function pickPublicationAudioTrack(
  pub: RemoteTrackPublication | LocalTrackPublication | undefined,
): RemoteAudioTrack | LocalAudioTrack | null {
  if (!pub || !pub.track) return null;
  return pub.track.kind === Track.Kind.Audio
    ? (pub.track as RemoteAudioTrack | LocalAudioTrack)
    : null;
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const enabled = isVoiceEnabled();
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<VoiceState>(initialState);

  const patch = useCallback((partial: Partial<VoiceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // ─── Participant view building ──────────────────────────────────────

  const buildParticipantView = useCallback(
    (p: RemoteParticipant | LocalParticipant): VoiceParticipantView => {
      let avatarUrl: string | null = null;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata) as { avatarUrl?: string };
          avatarUrl = meta.avatarUrl ?? null;
        }
      } catch {
        // ignore malformed metadata
      }
      const camPub = p.getTrackPublication(Track.Source.Camera);
      const screenPub = p.getTrackPublication(Track.Source.ScreenShare);
      const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio);

      const cameraTrack = pickPublicationVideoTrack(camPub);
      const screenShareTrack = pickPublicationVideoTrack(screenPub);
      const screenShareAudioTrack = pickPublicationAudioTrack(screenAudioPub);

      return {
        identity: p.identity,
        name: p.name ?? p.identity,
        avatarUrl,
        isLocal: 'localTrackPublications' in p,
        isSpeaking: p.isSpeaking,
        audioLevel: p.audioLevel,
        isMuted: p.isMicrophoneEnabled === false,
        isCameraEnabled: !!cameraTrack && !(camPub?.isMuted ?? true),
        isScreenSharing: !!screenShareTrack && !(screenPub?.isMuted ?? true),
        cameraTrack,
        screenShareTrack,
        screenShareAudioTrack,
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
      // Auto-spotlight whoever is currently sharing screen, unless the
      // user has explicitly pinned someone else.
      setState((prev) => {
        let spotlight = prev.spotlightIdentity;
        const sharer = [...map.values()].find((v) => v.isScreenSharing);
        if (sharer && (!spotlight || !map.get(spotlight)?.isScreenSharing)) {
          spotlight = sharer.identity;
        } else if (spotlight && !map.has(spotlight)) {
          spotlight = null;
        }
        return { ...prev, participants: map, spotlightIdentity: spotlight };
      });
    },
    [buildParticipantView],
  );

  // ─── Device discovery ───────────────────────────────────────────────

  const refreshDevices = useCallback<VoiceActions['refreshDevices']>(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all.filter((d) => d.kind === 'audioinput');
      const cameras = all.filter((d) => d.kind === 'videoinput');
      const outputs = all.filter((d) => d.kind === 'audiooutput');
      setState((prev) => ({ ...prev, devices: { mics, cameras, outputs } }));
    } catch {
      // Permissions denied — leave devices empty; pickers stay hidden.
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const handler = () => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handler);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handler);
  }, [enabled, refreshDevices]);

  // ─── Room lifecycle ─────────────────────────────────────────────────

  const teardownRoom = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    roomRef.current = null;
    try {
      await room.disconnect();
    } catch {
      // best-effort
    }
  }, []);

  const joinChannel = useCallback<VoiceActions['joinChannel']>(
    async (channelId, opts) => {
      if (!enabled) return;
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
        cameraEnabled: false,
        screenSharing: false,
        spotlightIdentity: null,
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

      const prefs = state.preferences;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          audioPreset: { maxBitrate: 64_000 }, // STANDARD-quality default
        },
        // Pull the audio cleanup toggles from the user's saved prefs.
        // When prefs haven't loaded yet, fall back to all-on (matches
        // the column defaults).
        audioCaptureDefaults: {
          autoGainControl: prefs?.autoGainControl ?? true,
          echoCancellation: prefs?.echoCancellation ?? true,
          noiseSuppression: prefs?.noiseSuppression ?? true,
          deviceId: prefs?.micDeviceId ?? undefined,
        },
        videoCaptureDefaults: {
          deviceId: prefs?.cameraDeviceId ?? undefined,
        },
      });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, () => refreshParticipants(room))
        .on(RoomEvent.ParticipantDisconnected, () => refreshParticipants(room))
        .on(RoomEvent.ActiveSpeakersChanged, () => refreshParticipants(room))
        .on(RoomEvent.TrackMuted, () => refreshParticipants(room))
        .on(RoomEvent.TrackUnmuted, () => refreshParticipants(room))
        .on(RoomEvent.TrackSubscribed, () => refreshParticipants(room))
        .on(RoomEvent.TrackUnsubscribed, () => refreshParticipants(room))
        .on(RoomEvent.LocalTrackPublished, () => refreshParticipants(room))
        .on(RoomEvent.LocalTrackUnpublished, () => {
          // If we just unpublished our screen share, sync the flag.
          const sharing = room.localParticipant.isScreenShareEnabled;
          const cam = room.localParticipant.isCameraEnabled;
          setState((prev) => ({
            ...prev,
            screenSharing: sharing,
            cameraEnabled: cam,
          }));
          refreshParticipants(room);
        })
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
        // VOICE_ACTIVITY: mic auto-opens at join.
        // PUSH_TO_TALK: mic stays closed until the user holds the key.
        const startWithMicOn = (prefs?.inputMode ?? 'VOICE_ACTIVITY') !== 'PUSH_TO_TALK';
        await room.localParticipant.setMicrophoneEnabled(startWithMicOn);
      } catch (err) {
        roomRef.current = null;
        patch({
          connectionState: 'error',
          error: (err as Error).message ?? 'Failed to connect to voice.',
        });
        return;
      }

      // micMuted reflects the actual mic state at join time. PTT mode
      // starts muted; voice-activity mode starts open.
      const startWithMicOn = (prefs?.inputMode ?? 'VOICE_ACTIVITY') !== 'PUSH_TO_TALK';
      patch({
        connectionState: 'connected',
        channelName: envelope.channel.name,
        micMuted: !startWithMicOn,
      });
      refreshParticipants(room);
      void refreshDevices();

      const socket = getVoiceSocket();
      if (socket && socket.connected) {
        socket.emit('voice:subscribe.channel', { channelId });
      }
    },
    [enabled, patch, refreshParticipants, refreshDevices, teardownRoom],
  );

  const leaveChannel = useCallback<VoiceActions['leaveChannel']>(async () => {
    const channelId = state.channelId;
    await teardownRoom();
    setState(initialState);
    if (channelId) {
      try {
        await api(apiPaths.voice.leave(channelId), { method: 'POST' });
      } catch {
        // webhook reconciliation catches this
      }
      const socket = getVoiceSocket();
      socket?.emit('voice:unsubscribe.channel', { channelId });
    }
  }, [state.channelId, teardownRoom]);

  // ─── Audio actions ──────────────────────────────────────────────────

  const toggleMute = useCallback<VoiceActions['toggleMute']>(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enableMic = state.micMuted; // currently muted → enabling
    await room.localParticipant.setMicrophoneEnabled(enableMic);
    patch({ micMuted: !enableMic, deafened: !enableMic ? state.deafened : false });
  }, [patch, state.micMuted, state.deafened]);

  const toggleDeafen = useCallback<VoiceActions['toggleDeafen']>(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !state.deafened;
    // Deafening also mutes the mic (Discord behavior); undeafening
    // restores it.
    if (next) {
      await room.localParticipant.setMicrophoneEnabled(false);
      patch({ deafened: true, micMuted: true });
    } else {
      await room.localParticipant.setMicrophoneEnabled(true);
      patch({ deafened: false, micMuted: false });
    }
  }, [patch, state.deafened]);

  const switchMicDevice = useCallback<VoiceActions['switchMicDevice']>(
    async (deviceId) => {
      const room = roomRef.current;
      if (!room) return;
      await room.switchActiveDevice('audioinput', deviceId);
      patch({ micDeviceId: deviceId });
    },
    [patch],
  );

  // ─── Video actions ──────────────────────────────────────────────────

  const toggleCamera = useCallback<VoiceActions['toggleCamera']>(
    async (deviceId) => {
      const room = roomRef.current;
      if (!room) return;
      const enable = !state.cameraEnabled;
      try {
        await room.localParticipant.setCameraEnabled(
          enable,
          deviceId ? { deviceId } : undefined,
        );
        patch({ cameraEnabled: enable, cameraDeviceId: deviceId ?? state.cameraDeviceId });
        refreshParticipants(room);
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Camera unavailable.' });
      }
    },
    [patch, refreshParticipants, state.cameraEnabled, state.cameraDeviceId],
  );

  const switchCameraDevice = useCallback<VoiceActions['switchCameraDevice']>(
    async (deviceId) => {
      const room = roomRef.current;
      if (!room) return;
      // If camera is on, hot-swap the device. If not on, just remember
      // the selection for next time the user turns it on.
      if (state.cameraEnabled) {
        await room.switchActiveDevice('videoinput', deviceId);
      }
      patch({ cameraDeviceId: deviceId });
    },
    [patch, state.cameraEnabled],
  );

  // ─── Screen share ───────────────────────────────────────────────────

  const toggleScreenShare = useCallback<VoiceActions['toggleScreenShare']>(
    async (quality = '1080p30', audio = true) => {
      const room = roomRef.current;
      if (!room) return;
      const enable = !state.screenSharing;
      const preset = SCREEN_SHARE_PRESETS[quality];
      try {
        await room.localParticipant.setScreenShareEnabled(enable, enable
          ? {
              audio,
              resolution: {
                width: preset.width,
                height: preset.height,
                frameRate: preset.maxFramerate,
              },
            }
          : undefined,
        );
        patch({ screenSharing: enable });
        refreshParticipants(room);
      } catch (err) {
        // User cancelled the OS picker — not an error worth surfacing.
        const msg = (err as Error).message ?? '';
        if (!/Permission denied|cancel/i.test(msg)) {
          patch({ error: msg || 'Screen share failed.' });
        }
      }
    },
    [patch, refreshParticipants, state.screenSharing],
  );

  // ─── Output device ──────────────────────────────────────────────────

  const switchOutputDevice = useCallback<VoiceActions['switchOutputDevice']>(
    async (deviceId) => {
      const room = roomRef.current;
      if (!room) return;
      try {
        await room.switchActiveDevice('audiooutput', deviceId);
      } catch {
        // Some browsers don't support output-device selection (Firefox).
      }
    },
    [],
  );

  // ─── Spotlight ──────────────────────────────────────────────────────

  const setSpotlight = useCallback<VoiceActions['setSpotlight']>((identity) => {
    setState((prev) => ({ ...prev, spotlightIdentity: identity }));
  }, []);

  // ─── Preferences (backend-persisted) ────────────────────────────────

  const loadPreferences = useCallback<VoiceActions['loadPreferences']>(async () => {
    if (!enabled) return;
    try {
      const prefs = await api<VoiceUserPreferences>(apiPaths.voice.preferences());
      setState((prev) => ({
        ...prev,
        preferences: prefs,
        micDeviceId: prefs.micDeviceId,
        cameraDeviceId: prefs.cameraDeviceId,
      }));
    } catch {
      // Best-effort — settings dialog will show defaults until the
      // backend is reachable.
    }
  }, [enabled]);

  const updatePreferences = useCallback<VoiceActions['updatePreferences']>(
    async (input) => {
      const prev = state.preferences;
      // Optimistic merge so the dialog UI feels instant.
      if (prev) {
        setState((s) => ({ ...s, preferences: { ...prev, ...input } as VoiceUserPreferences }));
      }
      try {
        const next = await api<VoiceUserPreferences>(apiPaths.voice.preferences(), {
          method: 'PATCH',
          body: input,
        });
        setState((s) => ({ ...s, preferences: next }));
      } catch (err) {
        // Roll back optimistic change.
        if (prev) setState((s) => ({ ...s, preferences: prev }));
        // eslint-disable-next-line no-console
        console.error('Failed to save voice preferences', err);
      }
    },
    [state.preferences],
  );

  // Pull prefs once on mount when voice is enabled and the user is
  // logged in (the api wrapper handles the auth check internally).
  useEffect(() => {
    if (!enabled) return;
    void loadPreferences();
  }, [enabled, loadPreferences]);

  // Disconnect cleanly on tab close.
  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      void teardownRoom();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled, teardownRoom]);

  // ─── Push-to-talk key handler ───────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    const prefs = state.preferences;
    if (!prefs || prefs.inputMode !== 'PUSH_TO_TALK' || !prefs.pttKey) return;
    if (state.connectionState !== 'connected' && state.connectionState !== 'reconnecting') {
      return;
    }
    // Don't grab the key when the user is typing.
    const isTypingTarget = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    let releaseTimer: ReturnType<typeof setTimeout> | null = null;

    const onDown = async (e: KeyboardEvent) => {
      if (e.code !== prefs.pttKey || e.repeat || isTypingTarget(e)) return;
      const room = roomRef.current;
      if (!room) return;
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      // Don't unmute if user is deafened — deafen wins.
      if (state.deafened) return;
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setState((prev) => ({ ...prev, micMuted: false, pttActive: true }));
      } catch {
        // ignore — mic permission probably denied
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code !== prefs.pttKey || isTypingTarget(e)) return;
      const room = roomRef.current;
      if (!room) return;
      // Hold mic open for releaseMs so word endings aren't clipped.
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(async () => {
        releaseTimer = null;
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
          setState((prev) => ({ ...prev, micMuted: true, pttActive: false }));
        } catch {
          // ignore
        }
      }, prefs.pttReleaseMs);
    };

    document.addEventListener('keydown', onDown);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('keydown', onDown);
      document.removeEventListener('keyup', onUp);
      if (releaseTimer) clearTimeout(releaseTimer);
    };
  }, [enabled, state.preferences, state.connectionState, state.deafened]);

  // ─── Global keyboard shortcuts ──────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;
    if (state.connectionState !== 'connected' && state.connectionState !== 'reconnecting') {
      return;
    }
    const prefs = state.preferences;

    const parseCombo = (combo: string | null | undefined): {
      key: string;
      ctrl: boolean;
      shift: boolean;
      alt: boolean;
      meta: boolean;
    } | null => {
      if (!combo) return null;
      const parts = combo.toLowerCase().split('+').map((p) => p.trim());
      const key = parts[parts.length - 1] ?? '';
      return {
        key,
        ctrl: parts.includes('ctrl'),
        shift: parts.includes('shift'),
        alt: parts.includes('alt'),
        meta: parts.includes('meta') || parts.includes('cmd'),
      };
    };

    const muteCombo = parseCombo(prefs?.shortcutMute ?? 'ctrl+shift+m');
    const deafenCombo = parseCombo(prefs?.shortcutDeafen ?? 'ctrl+shift+d');
    const disconnectCombo = parseCombo(prefs?.shortcutDisconnect ?? 'ctrl+shift+h');

    const isTypingTarget = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el.isContentEditable
      );
    };

    const matches = (
      e: KeyboardEvent,
      combo: ReturnType<typeof parseCombo>,
    ) =>
      combo !== null &&
      e.key.toLowerCase() === combo.key &&
      e.ctrlKey === combo.ctrl &&
      e.shiftKey === combo.shift &&
      e.altKey === combo.alt &&
      e.metaKey === combo.meta;

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (matches(e, muteCombo)) {
        e.preventDefault();
        void toggleMute();
      } else if (matches(e, deafenCombo)) {
        e.preventDefault();
        void toggleDeafen();
      } else if (matches(e, disconnectCombo)) {
        e.preventDefault();
        void leaveChannel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    enabled,
    state.connectionState,
    state.preferences,
    toggleMute,
    toggleDeafen,
    leaveChannel,
  ]);

  // Apply deafen → mute every remote audio (mic + screen-share-audio)
  // by setting its track volume to 0. Reverted to 1 on undeafen and
  // re-applied to newly-joined participants via the participants map.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    const target = state.deafened ? 0 : 1;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        const track = pub.track;
        if (track && 'setVolume' in track) {
          try {
            (track as RemoteAudioTrack).setVolume(target);
          } catch {
            // Track gone — ignore
          }
        }
      }
    }
  }, [state.deafened, state.participants]);

  const actions = useMemo<VoiceActions>(
    () => ({
      joinChannel,
      leaveChannel,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      toggleDeafen,
      switchMicDevice,
      switchCameraDevice,
      switchOutputDevice,
      refreshDevices,
      setSpotlight,
      loadPreferences,
      updatePreferences,
    }),
    [
      joinChannel,
      leaveChannel,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      toggleDeafen,
      switchMicDevice,
      switchCameraDevice,
      switchOutputDevice,
      refreshDevices,
      setSpotlight,
      loadPreferences,
      updatePreferences,
    ],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider.');
  return ctx;
}

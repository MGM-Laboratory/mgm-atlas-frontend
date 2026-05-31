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
import {
  playJoinChime,
  playLeaveChime,
  playMuteChime,
  playUnmuteChime,
} from './chimes';
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
  /**
   * Per-participant local volume (0-2, 1 = unity). Phase 5. Applied
   * client-side via LiveKit RemoteAudioTrack.setVolume() — never
   * affects what other peers hear. Identity → volume.
   */
  localVolume: Map<string, number>;
  /** Phase 5 — set of identities the local user has personally muted. */
  localMuted: Set<string>;
  /** Phase 6 — soundboard output volume (0-2, 1 = unity). */
  soundboardVolume: number;
  /** Phase 6 — clip id currently playing, null when nothing is. */
  soundboardPlayingClipId: string | null;
  /**
   * Phase 7 — LiveKit Participant.connectionQuality for the local
   * user. 'excellent' | 'good' | 'poor' | 'unknown'. Drives the
   * wifi-bar indicator in the persistent panel.
   */
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  /**
   * Phase 7 — active recording for the current channel, when one
   * exists. null when nothing is being recorded.
   */
  recording: {
    id: string;
    startedByUserId: string;
    startedByName: string;
    startedAt: number;
  } | null;
  /** Phase 8 — kind of the current channel ('STANDARD' or 'STAGE'). */
  channelKind: 'STANDARD' | 'STAGE';
  /** Phase 8 — local user's stage role (always SPEAKER in STANDARD). */
  stageRole: 'SPEAKER' | 'AUDIENCE';
  /** Phase 8 — true while the local user has a raised hand. */
  handRaised: boolean;
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
  // ─── Phase 5: per-participant local controls + moderation ─────────
  /** Set a participant's local volume (0-2, 1 = unity). Persists across track-resubscribes. */
  setLocalVolume: (identity: string, volume: number) => void;
  /** Local-mute (only the calling user stops hearing target). */
  toggleLocalMute: (identity: string) => void;
  /** Mod: force-mute another participant for everyone. */
  moderationMute: (identity: string, muted?: boolean) => Promise<void>;
  /** Mod: disconnect another participant from the channel. */
  moderationKick: (identity: string, reason?: string) => Promise<void>;
  /** Mod: move another participant to a different voice channel. */
  moderationMove: (identity: string, targetChannelId: string) => Promise<void>;
  // ─── Phase 6: soundboard ──────────────────────────────────────────
  /**
   * Play a soundboard clip into the channel for everyone to hear.
   * Publishes the decoded audio as a separate LiveKit audio track so
   * VAD on the mic isn't fooled by playback. Auto-unpublishes when
   * the clip ends or another clip starts.
   */
  playSoundboardClip: (clip: { id: string; url: string; durationMs: number }) => Promise<void>;
  /** Set soundboard output volume (0-2, 1 = unity). Persisted only in-memory. */
  setSoundboardVolume: (volume: number) => void;
  // ─── Phase 7: recording (mod-only) ────────────────────────────────
  /** Mod: start a recording on the current channel. */
  startRecording: (opts?: { audioOnly?: boolean }) => Promise<void>;
  /** Mod: stop the active recording on the current channel. */
  stopRecording: () => Promise<void>;
  // ─── Phase 8: stage channels ───────────────────────────────────────
  /** Audience: raise your hand. No-op in STANDARD channels. */
  raiseHand: () => Promise<void>;
  /** Audience: lower your hand. Mods can also lower others via lowerOther. */
  lowerHand: () => Promise<void>;
  /** Mod: lower someone else's raised hand. */
  lowerHandFor: (userId: string) => Promise<void>;
  /** Mod: promote an audience member to speaker. */
  stagePromote: (userId: string) => Promise<void>;
  /** Mod: demote a speaker back to audience. */
  stageDemote: (userId: string) => Promise<void>;
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
  localVolume: new Map(),
  localMuted: new Set(),
  soundboardVolume: 1,
  soundboardPlayingClipId: null,
  connectionQuality: 'unknown',
  recording: null,
  channelKind: 'STANDARD',
  stageRole: 'SPEAKER',
  handRaised: false,
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
  // Phase 7 — chimes pull their on/off from preferences, but room
  // event handlers are registered once at connect time. Keep a ref so
  // the handlers see the latest pref without re-binding.
  const roomPrefsRef = useRef<VoiceUserPreferences | null>(null);

  // ─── Phase 6: soundboard plumbing ───────────────────────────────────
  // One AudioContext + GainNode + MediaStreamAudioDestinationNode pair
  // for the lifetime of the provider. We pipe each decoded buffer
  // through the gain node into the destination, then publish the
  // destination's MediaStreamTrack to LiveKit. AudioBuffers are
  // cached so re-playing a clip is instant.
  const soundboardCtxRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    dest: MediaStreamAudioDestinationNode;
    track: MediaStreamTrack;
    publication: LocalTrackPublication | null;
    activeSource: AudioBufferSourceNode | null;
    activeClipId: string | null;
    bufferCache: Map<string, AudioBuffer>;
  } | null>(null);
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
        .on(RoomEvent.ParticipantConnected, () => {
          // Chime — guarded by saved pref + only after we've finished
          // the initial connect. We use a ref because state.preferences
          // can change between events.
          const p = roomPrefsRef.current;
          if (p?.soundsEnabled !== false) playJoinChime();
          refreshParticipants(room);
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          const p = roomPrefsRef.current;
          if (p?.soundsEnabled !== false) playLeaveChime();
          refreshParticipants(room);
        })
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
        .on(
          RoomEvent.ConnectionQualityChanged,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (quality: any, participant: any) => {
            // Only act on the local participant — peers' quality is
            // less actionable for the UI.
            if (participant?.identity !== room.localParticipant.identity) return;
            const q: 'excellent' | 'good' | 'poor' | 'unknown' =
              quality === 'excellent' || quality === 'good' || quality === 'poor'
                ? quality
                : 'unknown';
            patch({ connectionQuality: q });
          },
        )
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
      // starts muted; voice-activity mode starts open. Stage AUDIENCE
      // members force-mute since they can't publish anyway.
      const channelKind = envelope.channel.kind ?? 'STANDARD';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joinRole = ((envelope.participant as any)?.role ?? 'SPEAKER') as
        | 'SPEAKER'
        | 'AUDIENCE';
      const startWithMicOn =
        joinRole === 'SPEAKER' &&
        (prefs?.inputMode ?? 'VOICE_ACTIVITY') !== 'PUSH_TO_TALK';
      patch({
        connectionState: 'connected',
        channelName: envelope.channel.name,
        channelKind,
        stageRole: joinRole,
        handRaised: false,
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
    // Phase 7 — local feedback chime, prefs-gated.
    if (state.preferences?.soundsEnabled !== false) {
      if (enableMic) playUnmuteChime();
      else playMuteChime();
    }
  }, [patch, state.micMuted, state.deafened, state.preferences]);

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

  // ─── Phase 5: per-participant local controls ────────────────────────

  /**
   * Apply the local-mute + per-participant volume to every remote
   * audio track currently subscribed in the room. Called from the
   * effect that watches state.localMuted / state.localVolume below
   * AND on every refreshParticipants pass so newly-subscribed
   * tracks pick up the right volume immediately.
   */
  const applyLocalAudioOverrides = useCallback(
    (room: Room, localVolume: Map<string, number>, localMuted: Set<string>, deafened: boolean) => {
      for (const p of room.remoteParticipants.values()) {
        // Deafen wins for everyone; otherwise local-mute wins for
        // this identity; otherwise the user's per-participant volume
        // (1 = unity) is applied.
        const muted = deafened || localMuted.has(p.identity);
        const vol = muted ? 0 : (localVolume.get(p.identity) ?? 1);
        for (const pub of p.audioTrackPublications.values()) {
          const track = pub.track;
          if (track && 'setVolume' in track) {
            try {
              (track as RemoteAudioTrack).setVolume(vol);
            } catch {
              // Track gone — ignore
            }
          }
        }
      }
    },
    [],
  );

  const setLocalVolume = useCallback<VoiceActions['setLocalVolume']>(
    (identity, volume) => {
      // Clamp to [0, 2] — 2 = doubled output.
      const clamped = Math.max(0, Math.min(2, volume));
      setState((prev) => {
        const next = new Map(prev.localVolume);
        if (clamped === 1) next.delete(identity); // unity = no override
        else next.set(identity, clamped);
        return { ...prev, localVolume: next };
      });
    },
    [],
  );

  const toggleLocalMute = useCallback<VoiceActions['toggleLocalMute']>(
    (identity) => {
      setState((prev) => {
        const next = new Set(prev.localMuted);
        if (next.has(identity)) next.delete(identity);
        else next.add(identity);
        return { ...prev, localMuted: next };
      });
    },
    [],
  );

  // ─── Phase 5: server-side moderation (admin/PM only) ────────────────

  const moderationMute = useCallback<VoiceActions['moderationMute']>(
    async (identity, muted = true) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.moderateMute(channelId), {
          method: 'POST',
          body: { participantUserId: identity, muted },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to mute participant.' });
      }
    },
    [patch, state.channelId],
  );

  const moderationKick = useCallback<VoiceActions['moderationKick']>(
    async (identity, reason) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.moderateKick(channelId), {
          method: 'POST',
          body: { participantUserId: identity, reason },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to disconnect participant.' });
      }
    },
    [patch, state.channelId],
  );

  const moderationMove = useCallback<VoiceActions['moderationMove']>(
    async (identity, targetChannelId) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.moderateMove(channelId), {
          method: 'POST',
          body: { participantUserId: identity, targetChannelId },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to move participant.' });
      }
    },
    [patch, state.channelId],
  );

  // ─── Phase 7: recording (mod-only) ──────────────────────────────────

  const startRecording = useCallback<VoiceActions['startRecording']>(
    async (opts) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.recordingStart(channelId), {
          method: 'POST',
          body: { audioOnly: opts?.audioOnly ?? false },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to start recording.' });
      }
    },
    [patch, state.channelId],
  );

  const stopRecording = useCallback<VoiceActions['stopRecording']>(async () => {
    const channelId = state.channelId;
    if (!channelId) return;
    try {
      await api(apiPaths.voice.recordingStop(channelId), { method: 'POST' });
    } catch (err) {
      patch({ error: (err as Error).message ?? 'Failed to stop recording.' });
    }
  }, [patch, state.channelId]);

  // ─── Phase 8: stage channel actions ─────────────────────────────────

  const raiseHand = useCallback<VoiceActions['raiseHand']>(async () => {
    const channelId = state.channelId;
    if (!channelId) return;
    setState((prev) => ({ ...prev, handRaised: true })); // optimistic
    try {
      await api(apiPaths.voice.handRaise(channelId), { method: 'POST' });
    } catch (err) {
      setState((prev) => ({ ...prev, handRaised: false }));
      patch({ error: (err as Error).message ?? 'Failed to raise hand.' });
    }
  }, [patch, state.channelId]);

  const lowerHand = useCallback<VoiceActions['lowerHand']>(async () => {
    const channelId = state.channelId;
    if (!channelId) return;
    setState((prev) => ({ ...prev, handRaised: false }));
    try {
      await api(apiPaths.voice.handLower(channelId), {
        method: 'POST',
        body: {},
      });
    } catch (err) {
      patch({ error: (err as Error).message ?? 'Failed to lower hand.' });
    }
  }, [patch, state.channelId]);

  const lowerHandFor = useCallback<VoiceActions['lowerHandFor']>(
    async (userId) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.handLower(channelId), {
          method: 'POST',
          body: { targetUserId: userId },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to lower hand.' });
      }
    },
    [patch, state.channelId],
  );

  const stagePromote = useCallback<VoiceActions['stagePromote']>(
    async (userId) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.stagePromote(channelId), {
          method: 'POST',
          body: { participantUserId: userId },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to promote participant.' });
      }
    },
    [patch, state.channelId],
  );

  const stageDemote = useCallback<VoiceActions['stageDemote']>(
    async (userId) => {
      const channelId = state.channelId;
      if (!channelId) return;
      try {
        await api(apiPaths.voice.stageDemote(channelId), {
          method: 'POST',
          body: { participantUserId: userId },
        });
      } catch (err) {
        patch({ error: (err as Error).message ?? 'Failed to demote participant.' });
      }
    },
    [patch, state.channelId],
  );

  // ─── Phase 6: soundboard playback ───────────────────────────────────

  /** Ensure the AudioContext + destination track + publication exist. */
  const ensureSoundboardPipeline = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return null;
    if (soundboardCtxRef.current?.publication) return soundboardCtxRef.current;

    if (!soundboardCtxRef.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 1;
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      const track = dest.stream.getAudioTracks()[0];
      if (!track) return null;
      soundboardCtxRef.current = {
        ctx,
        gain,
        dest,
        track,
        publication: null,
        activeSource: null,
        activeClipId: null,
        bufferCache: new Map(),
      };
    }
    const ref = soundboardCtxRef.current;
    if (!ref.publication) {
      try {
        // Publish the destination track as a regular audio track.
        // LiveKit's per-source mute (Phase 5) doesn't apply here —
        // mods can still kick someone who's abusing the soundboard.
        ref.publication = await room.localParticipant.publishTrack(ref.track, {
          name: 'soundboard',
          source: Track.Source.Microphone, // closest source; UI never shows it
        });
      } catch {
        return null;
      }
    }
    return ref;
  }, []);

  const stopActiveSoundboard = useCallback(() => {
    const ref = soundboardCtxRef.current;
    if (!ref) return;
    if (ref.activeSource) {
      try {
        ref.activeSource.stop();
        ref.activeSource.disconnect();
      } catch {
        // already stopped
      }
      ref.activeSource = null;
    }
    ref.activeClipId = null;
    setState((prev) => ({ ...prev, soundboardPlayingClipId: null }));
  }, []);

  const playSoundboardClip = useCallback<VoiceActions['playSoundboardClip']>(
    async (clip) => {
      const room = roomRef.current;
      if (!room) return;
      const ref = await ensureSoundboardPipeline();
      if (!ref) return;

      // Stop any clip already playing — soundboards are mono-voice.
      stopActiveSoundboard();

      let buffer = ref.bufferCache.get(clip.id);
      if (!buffer) {
        try {
          const res = await fetch(clip.url, { mode: 'cors' });
          const ab = await res.arrayBuffer();
          buffer = await ref.ctx.decodeAudioData(ab);
          ref.bufferCache.set(clip.id, buffer);
        } catch (err) {
          patch({ error: (err as Error).message ?? 'Failed to load soundboard clip.' });
          return;
        }
      }

      // Apply the current soundboard volume right before play. The
      // setSoundboardVolume action updates this independently.
      ref.gain.gain.value = state.soundboardVolume;

      const source = ref.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ref.gain);
      ref.activeSource = source;
      ref.activeClipId = clip.id;
      setState((prev) => ({ ...prev, soundboardPlayingClipId: clip.id }));

      source.onended = () => {
        if (soundboardCtxRef.current?.activeSource === source) {
          stopActiveSoundboard();
        }
      };
      try {
        source.start();
      } catch {
        // Source already started or context suspended — try resuming.
        try {
          await ref.ctx.resume();
          source.start();
        } catch {
          stopActiveSoundboard();
        }
      }
    },
    [ensureSoundboardPipeline, patch, state.soundboardVolume, stopActiveSoundboard],
  );

  const setSoundboardVolume = useCallback<VoiceActions['setSoundboardVolume']>(
    (volume) => {
      const clamped = Math.max(0, Math.min(2, volume));
      const ref = soundboardCtxRef.current;
      if (ref) ref.gain.gain.value = clamped;
      setState((prev) => ({ ...prev, soundboardVolume: clamped }));
    },
    [],
  );

  // Tear down the soundboard pipeline whenever the room goes away.
  useEffect(() => {
    if (state.connectionState !== 'idle' && state.connectionState !== 'disconnected') return;
    const ref = soundboardCtxRef.current;
    if (!ref) return;
    if (ref.activeSource) {
      try {
        ref.activeSource.stop();
        ref.activeSource.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      void ref.ctx.close();
    } catch {
      // ignore
    }
    soundboardCtxRef.current = null;
  }, [state.connectionState]);

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

  // ─── Phase 5: handle "you were moved or kicked" events ──────────────
  // The backend emits these to the targeted user's per-user socket
  // room when a moderator acts on them. Two kinds:
  //   - kicked: the LiveKit room already disconnected us; we just show
  //     a toast-ish state via `error` and let the room go fully idle.
  //   - moved: the payload carries a fresh LiveKit URL + token; we
  //     teardown our current room and connect directly with the new
  //     token (skipping the /join REST roundtrip since the mod already
  //     minted server-side).
  useEffect(() => {
    if (!enabled) return;
    const socket = getVoiceSocket();
    if (!socket) return;
    const onModeratedAction = async (payload: {
      kind: 'kicked' | 'moved';
      sourceChannelId?: string;
      targetChannelId?: string;
      targetChannelName?: string;
      projectId?: string | null;
      url?: string;
      token?: string;
      reason?: string | null;
    }) => {
      if (payload.kind === 'kicked') {
        await teardownRoom();
        setState({
          ...initialState,
          error: payload.reason
            ? `You were disconnected by a moderator: ${payload.reason}`
            : 'You were disconnected by a moderator.',
          connectionState: 'error',
        });
        return;
      }
      if (payload.kind === 'moved' && payload.url && payload.token && payload.targetChannelId) {
        // Tear down current room then connect with the pre-minted token.
        if (roomRef.current) await teardownRoom();
        patch({
          connectionState: 'connecting',
          channelId: payload.targetChannelId,
          projectId: payload.projectId ?? null,
          channelName: payload.targetChannelName ?? null,
          error: null,
          participants: new Map(),
          ping: null,
        });
        const prefs = state.preferences;
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: { audioPreset: { maxBitrate: 64_000 } },
          audioCaptureDefaults: {
            autoGainControl: prefs?.autoGainControl ?? true,
            echoCancellation: prefs?.echoCancellation ?? true,
            noiseSuppression: prefs?.noiseSuppression ?? true,
            deviceId: prefs?.micDeviceId ?? undefined,
          },
          videoCaptureDefaults: { deviceId: prefs?.cameraDeviceId ?? undefined },
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
          .on(RoomEvent.Reconnecting, () => patch({ connectionState: 'reconnecting' }))
          .on(RoomEvent.Reconnected, () => patch({ connectionState: 'connected' }))
          .on(RoomEvent.Disconnected, () => {
            if (roomRef.current === room) {
              roomRef.current = null;
              setState(initialState);
            }
          });
        try {
          await room.connect(payload.url, payload.token);
          const startWithMicOn = (prefs?.inputMode ?? 'VOICE_ACTIVITY') !== 'PUSH_TO_TALK';
          await room.localParticipant.setMicrophoneEnabled(startWithMicOn);
          patch({ connectionState: 'connected', micMuted: !startWithMicOn });
        } catch (err) {
          roomRef.current = null;
          patch({ connectionState: 'error', error: (err as Error).message ?? 'Move failed.' });
        }
      }
    };
    socket.on('voice.moved-or-kicked', onModeratedAction);
    return () => {
      socket.off('voice.moved-or-kicked', onModeratedAction);
    };
  }, [enabled, patch, refreshParticipants, teardownRoom, state.preferences]);

  // Mirror state.preferences into a ref so RoomEvent handlers (which
  // capture stable closures) can read the latest soundsEnabled flag.
  useEffect(() => {
    roomPrefsRef.current = state.preferences;
  }, [state.preferences]);

  // ─── Phase 7: ping polling ───────────────────────────────────────────
  // LiveKit exposes RTT to the SFU on Room.engine.client.rtt (number,
  // ms) once the data channel is open. We sample it every 3s while
  // connected and write to state.ping. Skips when no room or
  // disconnected — the value is cleared by initialState on teardown.
  useEffect(() => {
    if (state.connectionState !== 'connected') return;
    const room = roomRef.current;
    if (!room) return;
    const tick = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine = (room as any).engine;
      const rtt: number | undefined = engine?.client?.rtt;
      if (typeof rtt === 'number' && Number.isFinite(rtt)) {
        setState((prev) => (prev.ping === rtt ? prev : { ...prev, ping: rtt }));
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [state.connectionState]);

  // ─── Phase 7: recording lifecycle events ─────────────────────────────
  // Listens for the channel-room voice.recording.* events emitted by
  // the backend. Updates state.recording so the persistent panel +
  // room header can render the red REC badge in real time.
  useEffect(() => {
    if (!enabled) return;
    if (state.connectionState !== 'connected' || !state.channelId) return;
    const socket = getVoiceSocket();
    if (!socket) return;
    const onStarted = (payload: {
      channelId: string;
      recordingId: string;
      startedByUserId: string;
      startedByName: string;
    }) => {
      if (payload.channelId !== state.channelId) return;
      setState((prev) => ({
        ...prev,
        recording: {
          id: payload.recordingId,
          startedByUserId: payload.startedByUserId,
          startedByName: payload.startedByName,
          startedAt: Date.now(),
        },
      }));
    };
    const onStopped = (payload: { channelId: string }) => {
      if (payload.channelId !== state.channelId) return;
      setState((prev) => ({ ...prev, recording: null }));
    };
    socket.on('voice.recording.started', onStarted);
    socket.on('voice.recording.stopped', onStopped);
    return () => {
      socket.off('voice.recording.started', onStarted);
      socket.off('voice.recording.stopped', onStopped);
    };
  }, [enabled, state.connectionState, state.channelId]);

  // ─── Phase 8: stage lifecycle events ────────────────────────────────
  // Channel-level events update the queue + per-participant role;
  // personally-addressed voice.stage.you.* fires for the local user
  // so they know they've been promoted/demoted even if their channel
  // subscription dropped briefly.
  useEffect(() => {
    if (!enabled) return;
    if (state.connectionState !== 'connected' || !state.channelId) return;
    const socket = getVoiceSocket();
    if (!socket) return;
    const localId = roomRef.current?.localParticipant.identity ?? null;

    const onYouPromoted = () => {
      setState((prev) => ({ ...prev, stageRole: 'SPEAKER', handRaised: false }));
    };
    const onYouDemoted = () => {
      setState((prev) => ({ ...prev, stageRole: 'AUDIENCE', handRaised: false, micMuted: true }));
      // Stop transmitting immediately if we were mid-sentence.
      const room = roomRef.current;
      if (room) void room.localParticipant.setMicrophoneEnabled(false);
    };
    const onHandLowered = (payload: { channelId: string; userId: string }) => {
      if (payload.channelId !== state.channelId) return;
      if (payload.userId === localId) {
        setState((prev) => ({ ...prev, handRaised: false }));
      }
    };
    socket.on('voice.stage.you.promoted', onYouPromoted);
    socket.on('voice.stage.you.demoted', onYouDemoted);
    socket.on('voice.stage.hand.lowered', onHandLowered);
    return () => {
      socket.off('voice.stage.you.promoted', onYouPromoted);
      socket.off('voice.stage.you.demoted', onYouDemoted);
      socket.off('voice.stage.hand.lowered', onHandLowered);
    };
  }, [enabled, state.connectionState, state.channelId]);

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

  // Apply deafen + local mute + per-participant volume to every remote
  // audio track. Re-runs whenever any of those inputs change OR a new
  // remote participant joins (state.participants identity-changes).
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    applyLocalAudioOverrides(room, state.localVolume, state.localMuted, state.deafened);
  }, [
    state.deafened,
    state.localVolume,
    state.localMuted,
    state.participants,
    applyLocalAudioOverrides,
  ]);

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
      setLocalVolume,
      toggleLocalMute,
      moderationMute,
      moderationKick,
      moderationMove,
      playSoundboardClip,
      setSoundboardVolume,
      startRecording,
      stopRecording,
      raiseHand,
      lowerHand,
      lowerHandFor,
      stagePromote,
      stageDemote,
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
      setLocalVolume,
      toggleLocalMute,
      moderationMute,
      moderationKick,
      moderationMove,
      playSoundboardClip,
      setSoundboardVolume,
      startRecording,
      stopRecording,
      raiseHand,
      lowerHand,
      lowerHandFor,
      stagePromote,
      stageDemote,
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

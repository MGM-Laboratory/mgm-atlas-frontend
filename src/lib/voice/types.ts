/**
 * Shared types for the voice feature. Mirrors the Prisma shapes the
 * backend returns. Keep field names identical to the backend's
 * `publicSelect` so the JSON-over-the-wire shape is the source of truth.
 */

export type VoiceAudioQuality = 'LOW' | 'STANDARD' | 'HIGH';

export interface VoiceParticipantPublic {
  id: string;
  userId: string;
  joinedAt: string;
  mutedByMod: boolean;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface VoiceChannelPublic {
  id: string;
  /** null = workspace lobby channel */
  projectId: string | null;
  name: string;
  topic: string | null;
  /** null = unlimited */
  userLimit: number | null;
  audioQuality: VoiceAudioQuality;
  isDefault: boolean;
  sortIndex: number;
  permissions: Record<string, unknown>;
  textThreadId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface VoiceChannelWithRoster extends VoiceChannelPublic {
  participants: VoiceParticipantPublic[];
}

export interface VoiceJoinEnvelope {
  /** LiveKit signaling WS URL (wss://atlas.labmgm.org/livekit in prod). */
  url: string;
  /** LiveKit JWT minted by the backend, scoped to this channel's room. */
  token: string;
  /** Deterministic LiveKit room name (`voice:<channelId>`). */
  roomName: string;
  participant: {
    id: string;
    channelId: string;
    userId: string;
    joinedAt: string;
    mutedByMod: boolean;
  };
  channel: {
    id: string;
    name: string;
    audioQuality: VoiceAudioQuality;
  };
}

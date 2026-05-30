'use client';

import { Loader2, Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/lib/voice/voice-provider';
import { ParticipantTile } from './participant-tile';

/**
 * Main voice-room view (lives at /projects/:slug/voice/:channelId
 * and /voice/:channelId for the lobby). Auto-joins the channelId on
 * mount; leaves are explicit (user clicks disconnect in the persistent
 * panel, or navigates to a different voice channel).
 *
 * Phase 1 shows audio-only avatars + speaking halos. Phase 2 layers
 * video/screen-share on top of the same grid.
 */
export function VoiceRoom({
  channelId,
  channelName,
  projectId,
}: {
  channelId: string;
  channelName: string;
  projectId: string | null;
}) {
  const { state, actions } = useVoice();

  // Auto-join when the route mounts AND we have no active call. If the
  // user is already in a DIFFERENT voice channel, we deliberately do
  // NOT auto-disconnect — they must explicitly confirm the switch via
  // the "Switch to X" button below (or via the sidebar dialog).
  // No cleanup: the call keeps running across page navigation; the
  // persistent panel lets them disconnect.
  useEffect(() => {
    if (state.channelId === channelId && state.connectionState !== 'idle') return;
    if (state.channelId !== null && state.channelId !== channelId) return;
    void actions.joinChannel(channelId, { projectId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, projectId]);

  if (state.connectionState === 'connecting' && state.channelId === channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" strokeWidth={2.25} />
        <div className="text-sm">Connecting to {channelName}…</div>
      </div>
    );
  }

  if (state.connectionState === 'error' && state.channelId === channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <div className="text-sm text-brand-red">
          Couldn&apos;t connect{state.error ? `: ${state.error}` : '.'}
        </div>
        <Button onClick={() => void actions.joinChannel(channelId, { projectId })}>
          Try again
        </Button>
      </div>
    );
  }

  // Already in a different channel — UI shows a switch confirmation.
  if (state.channelId && state.channelId !== channelId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <div className="text-sm">
          You&apos;re already in <strong>{state.channelName ?? 'another channel'}</strong>.
        </div>
        <Button onClick={() => void actions.joinChannel(channelId, { projectId })}>
          Switch to {channelName}
        </Button>
      </div>
    );
  }

  const participants = Array.from(state.participants.values());

  if (participants.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
        <Volume2 className="h-8 w-8 text-ink-3" strokeWidth={2.25} />
        <div className="text-sm">You&apos;re the only one here.</div>
        <div className="max-w-xs text-center text-xs text-ink-3">
          Share this voice channel with a teammate to start talking.
        </div>
      </div>
    );
  }

  // Grid: 2 cols at narrow, scales up with participant count.
  const colClass =
    participants.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : participants.length <= 4
        ? 'grid-cols-2'
        : participants.length <= 9
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-3 sm:grid-cols-4';

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2 text-ink-1">
        <Volume2 className="h-4 w-4" strokeWidth={2.25} />
        <h2 className="text-base font-medium">{channelName}</h2>
        <span className="text-xs text-ink-3">
          {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      <div className={`grid gap-3 ${colClass}`}>
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </div>
    </div>
  );
}

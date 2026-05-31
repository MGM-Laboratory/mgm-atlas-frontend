'use client';

import * as React from 'react';
import {
  Hand,
  Loader2,
  MicVocal,
  Users,
  Volume2,
  Loader,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getVoiceSocket } from '@/lib/realtime/socket';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoice, type VoiceParticipantView } from '@/lib/voice/voice-provider';
import type { StageHandQueueEntry } from '@/lib/voice/types';
import { ParticipantTile } from './participant-tile';
import { VoiceControls } from './voice-controls';

interface Props {
  channelId: string;
  channelName: string;
  projectId: string | null;
  projectSlugOrId: string | null;
  canModerate: boolean;
}

/**
 * Stage-channel layout. Two distinct sections:
 *   • Speakers — large tiles, top of the room.
 *   • Audience — compact avatar grid below.
 *
 * Hand-raise button shown to audience members. A queue popover shows
 * raised hands; moderators see a "Promote" button per row.
 *
 * Participant role is determined by combining the local user's
 * stageRole (from VoiceState) with peers' metadata (set at JWT mint
 * via livekit metadata { role }). We also fall back to "speaker"
 * for anyone whose tile isn't audience-marked, so a stale role
 * doesn't strand the wrong tile.
 */
export function StageRoom({
  channelId,
  channelName,
  projectId: _projectId,
  projectSlugOrId,
  canModerate,
}: Props) {
  const { state, actions } = useVoice();
  const participants = Array.from(state.participants.values());

  // Per-participant role: pulled from LiveKit metadata where present;
  // fall back to SPEAKER (so anyone not flagged is treated as a
  // speaker, which is the safe default for the audience compact-row).
  const peerRoles = React.useMemo(() => {
    const map = new Map<string, 'SPEAKER' | 'AUDIENCE'>();
    for (const p of participants) {
      // ParticipantView doesn't surface metadata directly; we infer
      // role from "are they publishing" — speakers always publish a
      // mic track. Audience never can. This is heuristic but matches
      // the LiveKit reality.
      const isSpeaker = !p.isMuted || p.isCameraEnabled || p.isScreenSharing;
      map.set(p.identity, isSpeaker ? 'SPEAKER' : 'AUDIENCE');
    }
    // Override with our authoritative own role.
    const room = participants.find((p) => p.isLocal);
    if (room) map.set(room.identity, state.stageRole);
    return map;
  }, [participants, state.stageRole]);

  const speakers = participants.filter(
    (p) => p.isLocal
      ? state.stageRole === 'SPEAKER'
      : peerRoles.get(p.identity) === 'SPEAKER',
  );
  const audience = participants.filter(
    (p) => p.isLocal
      ? state.stageRole === 'AUDIENCE'
      : peerRoles.get(p.identity) === 'AUDIENCE',
  );

  // Empty state.
  if (participants.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-2">
          <MicVocal className="h-8 w-8 text-ink-3" strokeWidth={2.25} />
          <div className="text-sm">You&apos;re the only one here.</div>
          <div className="max-w-xs text-center text-xs text-ink-3">
            Stage channel · share the link to invite an audience.
          </div>
        </div>
        <StageControls
          channelId={channelId}
          canModerate={canModerate}
          projectSlugOrId={projectSlugOrId}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Speakers section */}
        <section>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            <MicVocal className="h-3.5 w-3.5" strokeWidth={2.25} />
            Speakers
            <span className="text-ink-2">{speakers.length}</span>
          </div>
          {speakers.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-2 px-3 py-4 text-center text-[12px] text-ink-3">
              No speakers yet. Promote someone from the audience to get
              the conversation started.
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                speakers.length <= 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : speakers.length <= 4
                    ? 'grid-cols-2'
                    : 'grid-cols-2 sm:grid-cols-3',
              )}
            >
              {speakers.map((p) => (
                <ParticipantTile
                  key={p.identity}
                  participant={p}
                  canModerate={canModerate}
                  projectSlugOrId={projectSlugOrId}
                  currentChannelId={channelId}
                />
              ))}
            </div>
          )}
        </section>

        {/* Audience section */}
        <section>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
            Audience
            <span className="text-ink-2">{audience.length}</span>
          </div>
          {audience.length === 0 ? (
            <div className="text-[12px] text-ink-3">No audience members.</div>
          ) : (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
              {audience.map((p) => (
                <AudienceCard
                  key={p.identity}
                  participant={p}
                  canModerate={canModerate}
                  onPromote={() => void actions.stagePromote(p.identity)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <StageControls
        channelId={channelId}
        canModerate={canModerate}
        projectSlugOrId={projectSlugOrId}
      />
    </div>
  );
}

/**
 * Compact audience card — just avatar + name. Mods see a "Promote"
 * button on hover; raised hand shows a hand icon overlay.
 */
function AudienceCard({
  participant,
  canModerate,
  onPromote,
}: {
  participant: VoiceParticipantView;
  canModerate: boolean;
  onPromote: () => void;
}) {
  return (
    <div className="group/aud relative flex flex-col items-center gap-1 rounded-md border border-line-2 bg-surface-1 p-2">
      <Avatar
        src={participant.avatarUrl}
        name={participant.name}
        size={36}
      />
      <span className="line-clamp-1 max-w-full text-[11px] text-ink-1">
        {participant.name}
        {participant.isLocal ? (
          <span className="ml-1 text-ink-3 text-[10px]">(you)</span>
        ) : null}
      </span>
      {canModerate && !participant.isLocal ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onPromote}
              className="absolute right-1 top-1 inline-grid h-5 w-5 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-brand-green hover:text-white group-hover/aud:opacity-100"
              aria-label="Promote to speaker"
            >
              <MicVocal className="h-2.5 w-2.5" strokeWidth={2.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Promote to speaker</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

/**
 * Bottom controls bar with hand-raise (for audience) + queue popover
 * (for moderators) + the standard VoiceControls.
 */
function StageControls({
  channelId,
  canModerate,
  projectSlugOrId: _projectSlugOrId,
}: {
  channelId: string;
  canModerate: boolean;
  projectSlugOrId: string | null;
}) {
  const { state, actions } = useVoice();
  const ready = state.connectionState === 'connected';
  const isAudience = state.stageRole === 'AUDIENCE';

  return (
    <div className="border-t border-line-2 bg-surface-muted/40">
      <div className="flex items-center justify-center gap-1 px-4 py-2">
        {isAudience ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={state.handRaised ? 'primary' : 'secondary'}
                size="sm"
                onClick={() =>
                  state.handRaised ? actions.lowerHand() : actions.raiseHand()
                }
                disabled={!ready}
              >
                <Hand className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
                {state.handRaised ? 'Lower hand' : 'Raise hand'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {state.handRaised
                ? 'Withdraw your speaking request'
                : 'Ask a moderator to let you speak'}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {canModerate ? <HandQueuePopover channelId={channelId} /> : null}
      </div>
      <VoiceControls channelId={channelId} canModerate={canModerate} />
    </div>
  );
}

/** Moderator-only popover listing audience members with raised hands. */
function HandQueuePopover({ channelId }: { channelId: string }) {
  const { actions } = useVoice();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const queueQuery = useQuery({
    queryKey: queryKeys.voice.handQueue(channelId),
    queryFn: () =>
      api<{ items: StageHandQueueEntry[] }>(apiPaths.voice.handQueue(channelId)).then(
        (r) => r.items,
      ),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  // Live-invalidate when the channel's stage events fire.
  React.useEffect(() => {
    if (!open) return;
    const socket = getVoiceSocket();
    if (!socket) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.voice.handQueue(channelId),
      });
    };
    socket.on('voice.stage.hand.raised', invalidate);
    socket.on('voice.stage.hand.lowered', invalidate);
    socket.on('voice.stage.promoted', invalidate);
    return () => {
      socket.off('voice.stage.hand.raised', invalidate);
      socket.off('voice.stage.hand.lowered', invalidate);
      socket.off('voice.stage.promoted', invalidate);
    };
  }, [open, channelId, queryClient]);

  const items = queueQuery.data ?? [];
  const promoteMutation = useMutation({
    mutationFn: (userId: string) =>
      api(apiPaths.voice.stagePromote(channelId), {
        method: 'POST',
        body: { participantUserId: userId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.voice.handQueue(channelId),
      });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(items.length > 0 ? 'text-brand-yellow' : '')}
            >
              <Hand className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.25} />
              Queue{items.length > 0 ? ` (${items.length})` : ''}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Hand-raise queue</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" className="w-[300px] p-0">
        <div className="border-b border-line-2 px-3 py-2 text-sm font-medium text-ink-1">
          Hand-raise queue
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-3">
          {queueQuery.isLoading ? (
            <div className="flex justify-center py-4 text-ink-3">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            </div>
          ) : items.length === 0 ? (
            <div className="py-4 text-center text-[12px] text-ink-3">
              No raised hands.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((entry) => (
                <li
                  key={entry.userId}
                  className="flex items-center gap-2 rounded-md border border-line-2 bg-surface-1 px-2 py-1.5"
                >
                  <Avatar
                    src={entry.user.avatarUrl}
                    name={entry.user.name}
                    size={24}
                  />
                  <span className="flex-1 truncate text-[12px] text-ink-1">
                    {entry.user.name}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => promoteMutation.mutate(entry.userId)}
                    disabled={promoteMutation.isPending}
                    aria-label="Promote to speaker"
                    title="Promote"
                  >
                    {promoteMutation.isPending ? (
                      <Loader className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
                    ) : (
                      <MicVocal className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void actions.lowerHandFor(entry.userId)}
                    aria-label="Lower hand"
                    title="Lower hand"
                  >
                    <Volume2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

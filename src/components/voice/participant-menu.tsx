'use client';

import * as React from 'react';
import Link from 'next/link';
import { ExternalLink, Hand, Mic, MicOff, MicVocal, User2, VolumeX, X, ArrowRightCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useVoice, type VoiceParticipantView } from '@/lib/voice/voice-provider';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';

interface Props {
  participant: VoiceParticipantView;
  /** Open state — parent owns it (typically tied to right-click on the tile). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the menu attaches (x/y page coords, set on contextmenu). */
  anchor: { x: number; y: number } | null;
  /** Whether the current user has moderator rights for this voice channel. */
  canModerate: boolean;
  /**
   * Project slug needed to fetch sibling voice channels for the move
   * submenu. null for lobby channels (move not supported there).
   */
  projectSlugOrId: string | null;
  /** Current voice channel id — excluded from the move submenu. */
  currentChannelId: string;
}

/**
 * Per-participant context menu (Phase 5). Discord-equivalent: the
 * menu that opens when you right-click a participant tile.
 *
 * Items always shown:
 *   - User volume slider (0-200%, local-only, applied via LiveKit
 *     RemoteAudioTrack.setVolume)
 *   - Local mute toggle (don't hear this person — same gain to 0)
 *   - View profile (links to /users/:id)
 *
 * Moderator-only section (when canModerate AND target isn't local):
 *   - Server-mute
 *   - Disconnect
 *   - Move to → submenu listing sibling voice channels in this project
 */
export function ParticipantMenu({
  participant,
  open,
  onOpenChange,
  anchor,
  canModerate,
  projectSlugOrId,
  currentChannelId,
}: Props) {
  const { state, actions } = useVoice();

  const isLocal = participant.isLocal;
  const isLocalMuted = state.localMuted.has(participant.identity);
  const volume = state.localVolume.get(participant.identity) ?? 1;

  // Fetch sibling voice channels for the move submenu — only when the
  // menu is open AND moderator AND we have a project.
  const moveQuery = useQuery({
    queryKey: queryKeys.voice.channels(projectSlugOrId ?? ''),
    queryFn: () =>
      api<{ items: VoiceChannelWithRoster[] }>(apiPaths.voice.channels(projectSlugOrId!)).then(
        (r) => r.items,
      ),
    enabled: open && canModerate && !!projectSlugOrId,
    staleTime: 30_000,
  });

  const otherChannels = (moveQuery.data ?? []).filter(
    (c) => c.id !== currentChannelId && !c.archivedAt,
  );

  if (!anchor) return null;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Invisible 0-size trigger positioned at the anchor — we
          control the menu's open state externally from the tile. */}
      <div
        style={{
          position: 'fixed',
          left: anchor.x,
          top: anchor.y,
          width: 0,
          height: 0,
        }}
      >
        <DropdownMenuContent
          align="start"
          side="bottom"
          className="min-w-[240px]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="flex items-center gap-2">
            <span className="truncate">{participant.name}</span>
            {participant.isMuted ? (
              <MicOff
                className="h-3 w-3 text-brand-red"
                strokeWidth={2.5}
                aria-label="Muted"
              />
            ) : null}
          </DropdownMenuLabel>

          {/* Volume slider — hidden for local self (slider would be a no-op). */}
          {!isLocal ? (
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] text-ink-3">
                <span>User volume</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                value={Math.round(volume * 100)}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(next)) {
                    actions.setLocalVolume(participant.identity, next / 100);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full"
              />
              <DropdownMenuItem
                onSelect={() => actions.setLocalVolume(participant.identity, 1)}
                className="mt-1 justify-center text-[11px]"
              >
                Reset to 100%
              </DropdownMenuItem>
            </div>
          ) : null}

          {!isLocal ? (
            <DropdownMenuItem
              onSelect={() => actions.toggleLocalMute(participant.identity)}
              className="gap-2 text-[13px]"
            >
              <VolumeX className="h-3.5 w-3.5" strokeWidth={2.25} />
              {isLocalMuted ? 'Unmute (only for you)' : 'Mute (only for you)'}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem asChild>
            <Link
              href={`/users/${participant.identity}` as never}
              className="flex items-center gap-2 text-[13px]"
            >
              <User2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              View profile
              <ExternalLink className="ml-auto h-3 w-3 text-ink-3" strokeWidth={2.25} />
            </Link>
          </DropdownMenuItem>

          {canModerate && !isLocal ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-ink-3">
                Moderator actions
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() =>
                  void actions.moderationMute(
                    participant.identity,
                    !participant.isMuted,
                  )
                }
                className="gap-2 text-[13px]"
              >
                {participant.isMuted ? (
                  <Mic className="h-3.5 w-3.5" strokeWidth={2.25} />
                ) : (
                  <MicOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                )}
                {participant.isMuted ? 'Server-unmute' : 'Server-mute'}
              </DropdownMenuItem>
              {projectSlugOrId ? (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-3">
                    <ArrowRightCircle className="h-3 w-3" strokeWidth={2.25} />
                    Move to
                  </DropdownMenuLabel>
                  {moveQuery.isLoading ? (
                    <DropdownMenuItem disabled className="text-[12px]">
                      Loading…
                    </DropdownMenuItem>
                  ) : otherChannels.length === 0 ? (
                    <DropdownMenuItem disabled className="text-[12px]">
                      No other voice channels here.
                    </DropdownMenuItem>
                  ) : (
                    otherChannels.map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() =>
                          void actions.moderationMove(participant.identity, c.id)
                        }
                        className={cn(
                          'pl-7 text-[13px]',
                          c.archivedAt ? 'text-ink-3' : 'text-ink-1',
                        )}
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </>
              ) : null}
              {state.channelKind === 'STAGE' ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => void actions.stagePromote(participant.identity)}
                    className="gap-2 text-[13px]"
                  >
                    <MicVocal className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Promote to speaker
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void actions.stageDemote(participant.identity)}
                    className="gap-2 text-[13px]"
                  >
                    <Hand className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Move to audience
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem
                onSelect={() => void actions.moderationKick(participant.identity)}
                className="gap-2 text-[13px] text-brand-red focus:text-brand-red"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                Disconnect from channel
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

'use client';

import Link from 'next/link';
import { Volume2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';

interface Props {
  channel: VoiceChannelWithRoster;
  /** Link href — different for project channels vs lobby. */
  href: string;
  /** Highlight the row when the user is on this channel's route. */
  isActive?: boolean;
}

/**
 * Single voice-channel row in the sidebar / channel list. Renders:
 *   - Speaker icon (visually distinct from text channels)
 *   - Channel name (+ user-limit badge if set)
 *   - Live avatar stack of currently-connected participants
 *
 * Discord-style: clicking the row navigates to the room, which
 * auto-joins via the VoiceProvider. We don't intercept the click to
 * join here — that's done by VoiceRoom on mount, so the URL stays the
 * source of truth.
 */
export function VoiceChannelRow({ channel, href, isActive }: Props) {
  const { state } = useVoice();
  const isCurrent = state.channelId === channel.id;

  // Real-time avatar stack — prefer the provider's live participant
  // map when this is the user's current room, otherwise fall back to
  // the backend-supplied roster (snapshot from the last fetch + socket
  // 'voice.roster.update' invalidations).
  const liveAvatars = isCurrent
    ? Array.from(state.participants.values()).map((p) => ({
        userId: p.identity,
        name: p.name,
        avatarUrl: p.avatarUrl,
      }))
    : channel.participants.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        avatarUrl: p.user.avatarUrl,
      }));

  return (
    <Link
      href={href as never}
      className={cn(
        'group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-120 ease-out-soft',
        isActive || isCurrent
          ? 'bg-surface-muted text-ink-1'
          : 'text-ink-2 hover:bg-surface-muted hover:text-ink-1',
      )}
    >
      <Volume2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate">{channel.name}</span>
          {channel.userLimit ? (
            <span className="text-[10px] uppercase tracking-wide text-ink-3">
              {liveAvatars.length}/{channel.userLimit}
            </span>
          ) : null}
        </div>
        {channel.topic ? (
          <div className="truncate text-[11px] text-ink-3">{channel.topic}</div>
        ) : null}
        {liveAvatars.length > 0 ? (
          <div className="mt-1 flex -space-x-1.5">
            {liveAvatars.slice(0, 6).map((a) => (
              <Avatar
                key={a.userId}
                src={a.avatarUrl}
                name={a.name}
                size={24}
                className="ring-2 ring-surface-1"
              />
            ))}
            {liveAvatars.length > 6 ? (
              <div className="grid h-6 w-6 place-items-center rounded-full bg-surface-muted text-[9px] ring-2 ring-surface-1">
                +{liveAvatars.length - 6}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

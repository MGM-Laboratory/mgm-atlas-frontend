'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Volume2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useVoice } from '@/lib/voice/voice-provider';
import type { VoiceChannelWithRoster } from '@/lib/voice/types';

interface Props {
  channel: VoiceChannelWithRoster;
  href: string;
  /** Highlight when this is the active route. */
  isActive?: boolean;
}

/**
 * Single voice-channel row in the sidebar. Behavior:
 *   - Idle (no active call)        → Link, navigates + joins
 *   - Already in THIS channel      → Link, no-op (just navigates to the route)
 *   - In a DIFFERENT voice channel → intercepts the click and shows a
 *     confirmation dialog: "You're currently in <X>. Switching will
 *     disconnect you. Continue?"
 *
 * The actual disconnect+join happens via VoiceRoom on mount of the
 * destination route — the dialog just gates the navigation. Discord
 * does roughly this: clicking a different voice channel mid-call shows
 * a similar confirmation.
 */
export function VoiceChannelRow({ channel, href, isActive }: Props) {
  const router = useRouter();
  const { state } = useVoice();
  const isCurrent = state.channelId === channel.id;
  const isInOtherChannel =
    state.channelId !== null &&
    state.channelId !== channel.id &&
    (state.connectionState === 'connecting' ||
      state.connectionState === 'connected' ||
      state.connectionState === 'reconnecting');

  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Avatar stack: prefer live participant data when this is the
  // current room, otherwise fall back to the backend snapshot.
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

  const rowContent = (
    <>
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
    </>
  );

  const className = cn(
    'group flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-120 ease-out-soft text-left w-full',
    isActive || isCurrent
      ? 'bg-surface-muted text-ink-1'
      : 'text-ink-2 hover:bg-surface-muted hover:text-ink-1',
  );

  // When the user is in a different channel, render a button that
  // opens the confirmation dialog. Otherwise render a normal Link.
  if (isInOtherChannel) {
    return (
      <>
        <button
          type="button"
          className={className}
          onClick={() => setDialogOpen(true)}
        >
          {rowContent}
        </button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Switch voice channel?</DialogTitle>
            <DialogDescription>
              You&apos;re currently in{' '}
              <strong className="text-ink-1">
                {state.channelName ?? 'another voice channel'}
              </strong>
              . Joining <strong className="text-ink-1">{channel.name}</strong> will
              disconnect you from the current call.
            </DialogDescription>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Stay
              </Button>
              <Button
                onClick={() => {
                  setDialogOpen(false);
                  router.push(href as never);
                }}
              >
                Switch to {channel.name}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Link href={href as never} className={className}>
      {rowContent}
    </Link>
  );
}

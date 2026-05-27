'use client';

import * as React from 'react';
import { usePresenceStore } from '@/lib/realtime/presence-store';

/**
 * Slack-style "X is typing…" line under the message list. Pulls from
 * the Zustand presence store the socket layer writes into. Renders
 * nothing when no one is typing — fixed-height container in the
 * caller keeps layout from jumping.
 *
 * IMPORTANT: the selector must NOT return a fresh value (e.g.
 * `?? []`) when nothing has changed. `useSyncExternalStore` compares
 * snapshots with Object.is and throws "The result of getSnapshot
 * should be cached to avoid an infinite loop" when given a new
 * reference each call. We select the raw value (which IS stable
 * across renders) and treat undefined as "no one typing".
 */
export function TypingIndicator({ channelId }: { channelId: string }) {
  const typing = usePresenceStore((s) => s.typing[channelId]);

  if (!typing || typing.length === 0) {
    return <div className="h-4" />;
  }

  const names = typing.slice(0, 3).map((t) => t.name);
  const extra = typing.length - names.length;
  const label =
    typing.length === 1
      ? `${names[0]} is typing…`
      : typing.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : extra > 0
          ? `${names.join(', ')} and ${extra} more are typing…`
          : `${names.join(', ')} are typing…`;

  return (
    <div className="flex h-4 items-center gap-1.5 text-[12px] text-ink-3">
      <span className="inline-flex gap-0.5" aria-hidden>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </span>
      <span>{label}</span>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-ink-3"
      style={{
        animation: 'chat-typing-bounce 1s ease-in-out infinite',
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

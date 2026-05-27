'use client';

import * as React from 'react';
import { Pin, PinOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  messageId: string;
  isPinned: boolean;
  onChanged: () => void;
}

/**
 * Pin/Unpin control for the message hover bar. Pinning opens a small
 * popover with an optional note textarea — the manager can either
 * confirm with no note for a plain pin, or write a short context line
 * (max 280 chars) that surfaces both inline on the message and in the
 * pin panel. Unpinning is one click (no confirmation), matching the
 * lightweight feel of the rest of the hover bar.
 *
 * The Pin icon switches from outline (ink-2) to filled-brand-blue on
 * the active state, and gets a one-shot bounce animation on click so
 * the action feels acknowledged even before the network round trip.
 */
export function PinButton({ messageId, isPinned, onChanged }: Props) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [bouncing, setBouncing] = React.useState(false);

  const pinMutation = useMutation({
    mutationFn: (payload: { note?: string }) =>
      api(apiPaths.chat.pinMessage(messageId), {
        method: 'POST',
        body: payload.note ? { note: payload.note } : {},
      }),
    onSuccess: () => {
      setNote('');
      setOpen(false);
      onChanged();
    },
  });

  const unpinMutation = useMutation({
    mutationFn: () => api(apiPaths.chat.unpinMessage(messageId), { method: 'POST' }),
    onSuccess: onChanged,
  });

  const triggerBounce = () => {
    setBouncing(true);
    window.setTimeout(() => setBouncing(false), 540);
  };

  // Already pinned → one-click unpin (with a friendly bounce on the icon).
  if (isPinned) {
    return (
      <button
        type="button"
        title="Unpin"
        onClick={() => {
          triggerBounce();
          unpinMutation.mutate();
        }}
        className="inline-grid h-7 w-7 place-items-center rounded text-brand-blue hover:bg-surface-muted"
        disabled={unpinMutation.isPending}
      >
        <PinOff
          className={cn('h-3.5 w-3.5', bouncing && 'chat-pin-bounce')}
          strokeWidth={2.25}
        />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Pin"
          onClick={triggerBounce}
          className="inline-grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-surface-muted hover:text-ink"
        >
          <Pin
            className={cn('h-3.5 w-3.5', bouncing && 'chat-pin-bounce')}
            strokeWidth={2.25}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        className="w-[300px] p-3"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Pin className="h-3.5 w-3.5 text-brand-blue" strokeWidth={2.25} />
            Pin this message
          </div>
          <p className="text-[11px] text-ink-3">
            Add an optional note so the team knows why this is pinned.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Decision recorded here"
            maxLength={280}
            rows={3}
            className="w-full resize-none rounded border border-line bg-white p-2 text-[13px] outline-none focus:border-line-strong"
          />
          <div className="flex items-center justify-between text-[10px] text-ink-3">
            <span>{note.length}/280</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => pinMutation.mutate({ note: note.trim() || undefined })}
              loading={pinMutation.isPending}
            >
              <Pin className="h-3.5 w-3.5" strokeWidth={2.25} />
              Pin
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

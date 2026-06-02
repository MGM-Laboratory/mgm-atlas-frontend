'use client';

import * as React from 'react';
import { AlertTriangle, Check, CircleDashed, Loader2 } from 'lucide-react';
import { useSaveCoordinator } from './store';
import { cn } from '@/lib/utils';

function relativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

/**
 * One-line status indicator for an editable surface. Lives next to
 * the existing Yjs `<StatusPill>` (Live / Connecting / Offline) so
 * users can tell at a glance whether their work is persisted
 * independently of whether realtime collab is connected.
 */
export function SaveBadge({
  surfaceId,
  className,
}: {
  surfaceId: string;
  className?: string;
}) {
  const state = useSaveCoordinator((s) => s.surfaces[surfaceId]);
  // Ticks once a second so "Saved 12s ago" stays current without re-saving.
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (state?.status !== 'saved') return;
    const t = setInterval(force, 5000);
    return () => clearInterval(t);
  }, [state?.status]);

  if (!state) return null;
  const { status, lastSavedAt, lastError } = state;

  if (status === 'error') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] text-brand-red',
          className,
        )}
        title={lastError ?? undefined}
      >
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
        Couldn’t save
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] text-ink-3',
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
        Saving…
      </span>
    );
  }
  if (status === 'dirty') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] text-ink-3',
          className,
        )}
        title="Unsaved changes — will sync momentarily"
      >
        <CircleDashed className="h-3.5 w-3.5" strokeWidth={2.25} />
        Unsaved
      </span>
    );
  }
  if (status === 'saved' && lastSavedAt) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] text-ink-3',
          className,
        )}
      >
        <Check className="h-3.5 w-3.5 text-brand-green" strokeWidth={2.25} />
        Saved {relativeTime(lastSavedAt)}
      </span>
    );
  }
  return null;
}

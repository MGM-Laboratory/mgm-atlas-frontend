'use client';

import * as React from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { ChatLinkPreview } from '@/lib/types';

/**
 * Compact OG card shown above the composer when a user pastes a URL.
 * Sender can X it to send the link as plain text instead. The same
 * component renders next to messages once we surface saved previews
 * (deferred — for P3 we keep the composer-side display only).
 */
export function LinkPreviewCard({
  preview,
  onRemove,
}: {
  preview: ChatLinkPreview;
  onRemove?: () => void;
}) {
  const host = (() => {
    try {
      return new URL(preview.url).hostname;
    } catch {
      return preview.url;
    }
  })();

  return (
    <div className="relative flex gap-3 rounded-lg border border-line bg-white p-2 text-[13px]">
      {preview.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          className="h-14 w-20 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-14 w-20 shrink-0 place-items-center rounded bg-surface-muted text-ink-3">
          <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] uppercase tracking-[0.06em] text-ink-3">
          {preview.siteName ?? host}
        </div>
        {preview.title ? (
          <div className="truncate font-medium text-ink">{preview.title}</div>
        ) : (
          <div className="truncate text-ink-2">{preview.url}</div>
        )}
        {preview.description ? (
          <div className="line-clamp-2 text-ink-3">{preview.description}</div>
        ) : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label="Remove preview"
          onClick={onRemove}
          className="absolute right-1 top-1 inline-grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}

'use client';

import * as React from 'react';
import { FileText, Download } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types';

/**
 * Inline media rendering. Images open via lightbox-on-click (browser
 * native for now; richer lightbox in P3). Video and audio use the
 * standard `controls` UI. Other files render as a download chip.
 */
export function AttachmentRenderer({ attachment }: { attachment: ChatAttachment }) {
  switch (attachment.kind) {
    case 'IMAGE':
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="block max-w-[420px] overflow-hidden rounded border border-line"
        >
          {/* Plain img is fine — URL is on our CDN domain and we trust dimensions from the upload. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt=""
            width={attachment.width ?? undefined}
            height={attachment.height ?? undefined}
            className="block max-h-[360px] w-auto object-cover"
            loading="lazy"
          />
        </a>
      );
    case 'VIDEO':
      return (
        <video
          src={attachment.url}
          controls
          poster={attachment.posterUrl ?? undefined}
          className="max-h-[360px] max-w-[420px] rounded border border-line"
        />
      );
    case 'AUDIO':
      return (
        <audio
          src={attachment.url}
          controls
          className="w-[320px] rounded border border-line"
        />
      );
    case 'FILE':
    default:
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          download
          className="inline-flex max-w-[320px] items-center gap-2 rounded border border-line bg-white px-3 py-2 text-[13px] text-ink hover:border-line-strong"
        >
          <FileText className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <span className="truncate">{attachment.s3Key.split('/').pop() ?? 'file'}</span>
          <Download className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
        </a>
      );
  }
}

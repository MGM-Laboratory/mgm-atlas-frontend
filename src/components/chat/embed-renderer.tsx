'use client';

import * as React from 'react';

/**
 * Detects bare URLs to YouTube / Vimeo / Tenor / Giphy in the message
 * markdown and returns an iframe (video) or img (gif) — mirroring
 * Discord's auto-embed behaviour. Returns null when the URL doesn't
 * match a known provider so the caller can fall back to rendering it
 * as a plain link.
 */
export function EmbedFor({ url }: { url: string }) {
  const embed = detect(url);
  if (!embed) return null;

  switch (embed.kind) {
    case 'youtube':
      return (
        <div className="my-2 aspect-video w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${embed.id}`}
            title="YouTube embed"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      );
    case 'vimeo':
      return (
        <div className="my-2 aspect-video w-full max-w-[560px] overflow-hidden rounded-lg border border-line bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${embed.id}`}
            title="Vimeo embed"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      );
    case 'gif':
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="my-2 block max-w-[360px] overflow-hidden rounded-lg border border-line"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={embed.previewUrl} alt="GIF" loading="lazy" className="block w-full" />
        </a>
      );
  }
}

interface Detected {
  kind: 'youtube' | 'vimeo' | 'gif';
  id: string;
  previewUrl: string;
}

function detect(raw: string): Detected | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();

  // YouTube
  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '').split('/')[0];
    if (id) return { kind: 'youtube', id, previewUrl: '' };
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const v = u.searchParams.get('v');
    if (v) return { kind: 'youtube', id: v, previewUrl: '' };
    const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/);
    if (m) return { kind: 'youtube', id: m[1], previewUrl: '' };
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const m = u.pathname.match(/^\/(\d{6,})/);
    if (m) return { kind: 'vimeo', id: m[1], previewUrl: '' };
  }
  if (host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/video\/(\d{6,})/);
    if (m) return { kind: 'vimeo', id: m[1], previewUrl: '' };
  }

  // Tenor / Giphy: any direct media URL → render as image.
  if (
    (host.endsWith('tenor.com') || host.endsWith('giphy.com')) &&
    /\.(gif|mp4|webp)(\?|$)/i.test(u.pathname)
  ) {
    return { kind: 'gif', id: raw, previewUrl: raw };
  }
  // Tenor view pages — fall back to the bare URL, we can't extract a
  // preview without an API call. Returning null lets the link preview
  // server fetch handle these.

  return null;
}

/**
 * Module-level helper so MarkdownBody can probe a URL without
 * rendering anything (used to decide whether to consume an entire
 * line that's just a bare URL).
 */
export function isEmbeddable(url: string): boolean {
  return detect(url) !== null;
}

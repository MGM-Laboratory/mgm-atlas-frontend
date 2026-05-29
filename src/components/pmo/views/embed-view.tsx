'use client';

import * as React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Renders an external URL in a sandboxed iframe. Whether a site allows
 * framing (X-Frame-Options / CSP frame-ancestors) can't be reliably read
 * from JS, so we use a heuristic: if `onLoad` hasn't fired within a few
 * seconds we surface a fallback overlay with an "open in new tab" escape.
 * The iframe stays mounted underneath, so a slow-but-allowed site still
 * appears once it loads.
 */
export function EmbedView({ url, label }: { url: string; label: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    setLoaded(false);
    setBlocked(false);
    timer.current = setTimeout(() => setBlocked(true), 6000);
    return () => clearTimeout(timer.current);
  }, [url]);

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw url */
  }

  return (
    <div className="relative h-[calc(100vh-260px)] min-h-[480px] overflow-hidden rounded-lg border border-line bg-white">
      <iframe
        key={url}
        src={url}
        title={label}
        className="h-full w-full"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer"
        onLoad={() => {
          clearTimeout(timer.current);
          setLoaded(true);
          setBlocked(false);
        }}
      />

      {!loaded && !blocked ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white">
          <Loader2 className="h-5 w-5 animate-spin text-ink-3" strokeWidth={2.25} />
        </div>
      ) : null}

      {blocked && !loaded ? (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white text-center',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`}
            alt=""
            className="h-10 w-10 rounded"
          />
          <div>
            <p className="text-[14px] font-medium text-ink">{label}</p>
            <p className="text-[12px] text-ink-3">
              <span className="font-medium">{host}</span> may not allow embedding.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" strokeWidth={2.25} />
              Open in new tab
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

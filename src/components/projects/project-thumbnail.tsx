'use client';

import * as React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectMedia, ProjectPhase, MediaType } from '@/lib/types';

interface Props {
  thumbnailUrl: string | null;
  thumbnailType: MediaType | null;
  previewMedia?: ProjectMedia[];
  alt: string;
  /** Autoplay video on hover when type=VIDEO. */
  hoverPlay?: boolean;
  className?: string;
}

export function ProjectThumbnail({
  thumbnailUrl,
  thumbnailType,
  previewMedia,
  alt,
  hoverPlay = false,
  className,
}: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const isVideo = thumbnailType === 'VIDEO';

  // Cycle through additional gallery images on hover when no video.
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (!hoverPlay || isVideo || !previewMedia?.length) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % (previewMedia.length + 1));
    }, 1800);
    return () => window.clearInterval(id);
  }, [hoverPlay, isVideo, previewMedia]);

  React.useEffect(() => {
    if (!hoverPlay || !isVideo || !videoRef.current) return;
    const video = videoRef.current;
    void video.play().catch(() => undefined);
    return () => {
      video?.pause();
      if (video) video.currentTime = 0;
    };
  }, [hoverPlay, isVideo]);

  const currentSrc = idx === 0 || isVideo ? thumbnailUrl : previewMedia?.[idx - 1]?.url;

  return (
    <div
      className={cn(
        'relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-muted',
        className,
      )}
    >
      {isVideo && thumbnailUrl ? (
        <video
          ref={videoRef}
          src={thumbnailUrl}
          muted
          playsInline
          loop
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : currentSrc ? (
        <Image
          src={currentSrc}
          alt={alt}
          fill
          sizes="(max-width: 768px) 80vw, 320px"
          className="object-cover transition-opacity duration-200"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-ink-4">
          <span className="text-[14px]">No thumbnail</span>
        </div>
      )}
      {isVideo ? (
        <span className="absolute right-2 top-2 inline-grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white">
          <Play className="h-3.5 w-3.5 fill-current" />
        </span>
      ) : null}
    </div>
  );
}

export function PhaseBadge({ phase }: { phase: ProjectPhase }) {
  const labelMap: Record<ProjectPhase, string> = {
    IDEA: 'Idea',
    PLANNING: 'Planning',
    IN_DEVELOPMENT: 'In dev',
    IN_REVIEW: 'In review',
    SHIPPED: 'Shipped',
    ARCHIVED: 'Archived',
  };
  const toneMap: Record<ProjectPhase, string> = {
    IDEA: 'bg-surface-muted text-ink-2',
    PLANNING: 'bg-brand-yellow-50 text-brand-yellow-ink',
    IN_DEVELOPMENT: 'bg-brand-blue-50 text-brand-blue',
    IN_REVIEW: 'bg-brand-yellow-50 text-brand-yellow-ink',
    SHIPPED: 'bg-brand-green-50 text-brand-green',
    ARCHIVED: 'bg-surface-muted text-ink-3',
  };
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium uppercase tracking-[0.08em]',
        toneMap[phase],
      )}
    >
      {labelMap[phase]}
    </span>
  );
}

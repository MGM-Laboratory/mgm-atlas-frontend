'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Users, ArrowRight } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProjectCard as ProjectCardData } from '@/lib/types';
import { PhaseBadge, ProjectThumbnail } from './project-thumbnail';

interface Props {
  project: ProjectCardData;
  /** Width applied via inline style. Useful inside scroll rows. */
  width?: number;
  /** When true, renders a static card without hover expansion (mobile, list views). */
  static?: boolean;
  className?: string;
}

export function ProjectCard({ project, width, static: isStatic = false, className }: Props) {
  // Inside scroll rows we render with a fixed width so cards line up; inside a
  // CSS grid (browse page) we let the grid cell define the width so they don't
  // overflow / overlap one another.
  const resolvedWidth = isStatic ? undefined : width ?? 320;
  const [hovered, setHovered] = React.useState(false);
  const [coords, setCoords] = React.useState<{ left: number; top: number; width: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const hoverTimer = React.useRef<number | null>(null);

  const onEnter = () => {
    if (isStatic) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setCoords({ left: rect.left, top: rect.top, width: rect.width });
      setHovered(true);
    }, 220);
  };
  const onLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHovered(false);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={cn(
        'relative snap-start',
        isStatic ? 'w-full' : 'shrink-0',
        className,
      )}
      style={resolvedWidth ? { width: resolvedWidth } : undefined}
    >
      {/* Base card — always visible */}
      <Link
        href={`/projects/${project.slug}` as never}
        className="block focus:outline-none"
        aria-label={`Open ${project.title}`}
      >
        <ProjectThumbnail
          thumbnailUrl={project.thumbnailUrl}
          thumbnailType={project.thumbnailType}
          alt={project.title}
        />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[17px] font-semibold leading-tight tracking-[-0.005em] text-ink">
              {project.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <PhaseBadge phase={project.phase} />
              {project.tags.slice(0, 2).map((t) => (
                <Badge key={t.id} tone="neutral">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
          {project.visibility === 'PRIVATE' ? (
            <span title="Private — team only" className="text-ink-3">
              <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
      </Link>

      {/* Hover-expanded overlay — desktop only via @media-hover */}
      {hovered && coords ? <ExpandedOverlay project={project} anchor={coords} onLeave={onLeave} /> : null}
    </div>
  );
}

function ExpandedOverlay({
  project,
  anchor,
  onLeave,
}: {
  project: ProjectCardData;
  anchor: { left: number; top: number; width: number };
  onLeave: () => void;
}) {
  // Render via fixed positioning so the expanded card escapes overflow:hidden
  // on parent scroll rows, and so its shadow does not get clipped.
  const expandedWidth = Math.max(anchor.width, 380);
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - expandedWidth / 2, 16),
    window.innerWidth - expandedWidth - 16,
  );
  const top = Math.max(anchor.top - 16, 16);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      onMouseLeave={onLeave}
      className="pointer-events-auto fixed z-30 hidden overflow-hidden rounded-lg bg-white shadow-3 md:block"
      style={{ left, top, width: expandedWidth }}
    >
      <Link href={`/projects/${project.slug}` as never} className="block">
        <ProjectThumbnail
          thumbnailUrl={project.thumbnailUrl}
          thumbnailType={project.thumbnailType}
          previewMedia={project.previewMedia}
          alt={project.title}
          hoverPlay
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-h3 leading-tight tracking-[-0.005em] text-ink">
                {project.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[14px] text-ink-2">
                {project.shortDescription}
              </p>
            </div>
            <PhaseBadge phase={project.phase} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {project.tags.slice(0, 4).map((t) => (
              <Badge key={t.id} tone="info">
                {t.name}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={project.owner.avatarUrl} name={project.owner.name} size={24} />
              <span className="text-[13px] text-ink-2">{project.owner.name}</span>
              <span aria-hidden className="text-ink-4">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] text-ink-3">
                <Users className="h-3.5 w-3.5" strokeWidth={2.25} />
                {project.memberCount}
              </span>
            </div>
            {project.collaborationRoles.length > 0 ? (
              <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-brand-blue">
                Recruiting
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="flex gap-2 border-t border-line p-3">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/projects/${project.slug}` as never}>
            View project
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Link>
        </Button>
        {project.collaborationRoles.length > 0 ? (
          <Button asChild size="sm" variant="secondary" className="flex-1">
            <Link href={`/projects/${project.slug}?contribute=1` as never}>Contribute</Link>
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

'use client';

import { cn } from '@/lib/utils';
import type { TaskStatus, TaskStatusCategory } from '@/lib/types';

const COLOR_DOT: Record<string, string> = {
  blue: 'bg-brand-blue',
  yellow: 'bg-brand-yellow',
  red: 'bg-brand-red',
  green: 'bg-brand-green',
  neutral: 'bg-ink-4',
};

const COLOR_PILL: Record<string, string> = {
  blue: 'bg-brand-blue-50 text-brand-blue border-brand-blue/30',
  yellow: 'bg-brand-yellow-50 text-brand-yellow-ink border-brand-yellow/40',
  red: 'bg-brand-red-50 text-brand-red border-brand-red/30',
  green: 'bg-brand-green-50 text-brand-green border-brand-green/30',
  neutral: 'bg-surface-muted text-ink-2 border-line',
};

function resolveColor(color: string, category: TaskStatusCategory): string {
  if (color in COLOR_DOT) return color;
  switch (category) {
    case 'TODO':
      return 'neutral';
    case 'IN_PROGRESS':
      return 'blue';
    case 'DONE':
      return 'green';
    case 'CANCELLED':
      return 'red';
    default:
      return 'neutral';
  }
}

export function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  const c = resolveColor(status.color, status.category);
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', COLOR_DOT[c], className)}
      aria-hidden
    />
  );
}

export function StatusPill({
  status,
  size = 'md',
  className,
}: {
  status: TaskStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const c = resolveColor(status.color, status.category);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        COLOR_PILL[c],
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-[12px]',
        className,
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', COLOR_DOT[c])} aria-hidden />
      {status.name}
    </span>
  );
}

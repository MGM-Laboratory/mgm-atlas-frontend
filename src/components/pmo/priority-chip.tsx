'use client';

import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskPriority } from '@/lib/types';
import { TASK_PRIORITY_LABEL } from '@/lib/types';

const ICONS: Record<TaskPriority, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  NONE: Minus,
  LOW: ChevronDown,
  MEDIUM: Minus,
  HIGH: ChevronUp,
  URGENT: ChevronsUp,
};

// Suppress dead-code warning for the unused ChevronsDown import in some bundlers.
void ChevronsDown;

const TONES: Record<TaskPriority, string> = {
  NONE: 'text-ink-3',
  LOW: 'text-ink-2',
  MEDIUM: 'text-brand-blue',
  HIGH: 'text-brand-yellow-ink',
  URGENT: 'text-brand-red',
};

export function PriorityChip({
  priority,
  className,
  size = 'sm',
}: {
  priority: TaskPriority;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const Icon = ICONS[priority];
  const tone = TONES[priority];
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span
      className={cn('inline-flex items-center gap-1', tone, className)}
      aria-label={`Priority: ${TASK_PRIORITY_LABEL[priority]}`}
      title={TASK_PRIORITY_LABEL[priority]}
    >
      <Icon className={iconSize} strokeWidth={2.5} />
    </span>
  );
}

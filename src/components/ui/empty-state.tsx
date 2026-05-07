import * as React from 'react';
import { PatternCorner } from '@/components/brand/pattern-corner';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-white p-10 text-center',
        className,
      )}
    >
      <PatternCorner position="top-right" size={2} cellSize={36} className="opacity-90" />
      <h3 className="font-display text-h3 text-ink">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-prose text-body-sm text-ink-2">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

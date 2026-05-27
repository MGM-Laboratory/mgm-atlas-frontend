'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PmoBrandColor } from '@/lib/types';

/**
 * The 5 brand tokens a task list icon can be tinted with. Mirrors the
 * `iconColor` column on TaskList; the renderer maps each token to a
 * Tailwind background / text class.
 */
export const PMO_BRAND_COLORS: PmoBrandColor[] = ['blue', 'yellow', 'red', 'green', 'neutral'];

const SWATCH_BG: Record<PmoBrandColor, string> = {
  blue: 'bg-brand-blue',
  yellow: 'bg-brand-yellow',
  red: 'bg-brand-red',
  green: 'bg-brand-green',
  neutral: 'bg-ink-3',
};

export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: PmoBrandColor;
  onChange: (color: PmoBrandColor) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {PMO_BRAND_COLORS.map((c) => {
        const selected = c === value;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color: ${c}`}
            aria-pressed={selected}
            className={cn(
              'relative h-8 w-8 rounded-full transition-shadow duration-120 ease-out-soft',
              SWATCH_BG[c],
              selected
                ? 'ring-2 ring-offset-2 ring-focus shadow-1'
                : 'hover:ring-2 hover:ring-offset-2 hover:ring-line-strong',
            )}
          >
            {selected ? (
              <Check
                strokeWidth={3}
                className={cn(
                  'absolute inset-0 m-auto h-4 w-4',
                  c === 'yellow' ? 'text-ink' : 'text-white',
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Get the Tailwind background class for a brand color token. Use this in
 * any pill / chip / badge that needs the same color treatment as the
 * task-list icon swatch.
 */
export function pmoBgClass(color: PmoBrandColor | string | null | undefined): string {
  return SWATCH_BG[(color as PmoBrandColor) in SWATCH_BG ? (color as PmoBrandColor) : 'neutral'];
}

/**
 * Foreground (icon / text) color class that contrasts the swatch
 * background. Yellow needs dark text; everything else gets white.
 */
export function pmoFgClass(color: PmoBrandColor | string | null | undefined): string {
  return color === 'yellow' ? 'text-ink' : 'text-white';
}

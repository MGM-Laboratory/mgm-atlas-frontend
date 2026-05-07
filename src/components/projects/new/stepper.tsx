'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  steps: { key: string; label: string }[];
  activeIndex: number;
  onStep?: (index: number) => void;
}

export function Stepper({ steps, activeIndex, onStep }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (done && onStep ? onStep(i) : undefined)}
              disabled={!done}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'inline-grid h-7 w-7 place-items-center rounded-full text-[12px] font-medium transition-colors',
                current
                  ? 'bg-brand-blue text-white'
                  : done
                    ? 'bg-brand-blue-50 text-brand-blue hover:bg-brand-blue/10'
                    : 'bg-surface-muted text-ink-3',
                done ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </button>
            <span
              className={cn(
                'text-[13px] font-medium',
                current ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-3',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden className="ml-1 hidden h-px w-8 bg-line sm:inline-block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

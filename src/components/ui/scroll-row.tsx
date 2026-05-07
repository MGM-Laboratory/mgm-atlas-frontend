'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Horizontal scroll row with arrow controls and snap points (Netflix-style). */
export function ScrollRow({ children, className, ariaLabel }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className={cn('group/row relative', className)}>
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        className="scroll-hidden flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(-600)}
        aria-label="Scroll left"
        className={cn(
          'absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-3 -translate-y-1/2',
          'place-items-center rounded-full bg-white text-ink shadow-2 transition-opacity duration-200',
          'opacity-0 group-hover/row:opacity-100 hover:opacity-100',
          'md:grid',
        )}
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(600)}
        aria-label="Scroll right"
        className={cn(
          'absolute right-0 top-1/2 z-10 hidden h-10 w-10 translate-x-3 -translate-y-1/2',
          'place-items-center rounded-full bg-white text-ink shadow-2 transition-opacity duration-200',
          'opacity-0 group-hover/row:opacity-100 hover:opacity-100',
          'md:grid',
        )}
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

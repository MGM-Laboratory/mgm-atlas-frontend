'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 4, ...rest }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      data-invalid={invalid ? 'true' : undefined}
      className={cn(
        'w-full resize-y rounded bg-white px-3.5 py-2.5 text-[15px] text-ink',
        'border border-line placeholder:text-ink-4',
        'transition-[border-color,box-shadow] duration-120 ease-out-soft',
        'hover:border-line-strong',
        'focus:outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(58,109,197,0.15)]',
        'disabled:bg-surface-muted disabled:text-ink-4',
        'data-[invalid=true]:border-brand-red',
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

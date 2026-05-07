'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = 'text', ...rest }, ref) => (
    <input
      ref={ref}
      type={type}
      data-invalid={invalid ? 'true' : undefined}
      className={cn(
        'h-10 w-full rounded bg-white px-3.5 text-[15px] text-ink',
        'border border-line placeholder:text-ink-4',
        'transition-[border-color,box-shadow] duration-120 ease-out-soft',
        'hover:border-line-strong',
        'focus:outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(58,109,197,0.15)]',
        'disabled:bg-surface-muted disabled:text-ink-4',
        'data-[invalid=true]:border-brand-red data-[invalid=true]:focus:shadow-[0_0_0_3px_rgba(249,65,65,0.15)]',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

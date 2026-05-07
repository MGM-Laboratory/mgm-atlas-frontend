'use client';

import * as React from 'react';
import * as RadixLabel from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ElementRef<typeof RadixLabel.Root>,
  React.ComponentPropsWithoutRef<typeof RadixLabel.Root> & { required?: boolean }
>(({ className, required, children, ...rest }, ref) => (
  <RadixLabel.Root
    ref={ref}
    className={cn(
      'mb-1.5 block text-[13px] font-medium tracking-[0.005em] text-ink',
      className,
    )}
    {...rest}
  >
    {children}
    {required ? <span className="ml-1 text-brand-red">*</span> : null}
  </RadixLabel.Root>
));
Label.displayName = 'Label';

export function FieldHelp({
  children,
  error,
  className,
}: {
  children?: React.ReactNode;
  error?: string;
  className?: string;
}) {
  if (!children && !error) return null;
  return (
    <span
      className={cn(
        'mt-1.5 block text-[13px]',
        error ? 'text-brand-red' : 'text-ink-3',
        className,
      )}
    >
      {error ?? children}
    </span>
  );
}

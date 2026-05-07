'use client';

import * as React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, ...rest }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5',
      'bg-line-strong data-[state=checked]:bg-brand-blue',
      'transition-colors duration-200 ease-out-soft',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      'disabled:opacity-40 disabled:pointer-events-none',
      className,
    )}
    {...rest}
  >
    <RadixSwitch.Thumb
      className={cn(
        'block h-4 w-4 rounded-full bg-white shadow-1',
        'transition-transform duration-200 ease-out-soft',
        'data-[state=checked]:translate-x-4',
      )}
    />
  </RadixSwitch.Root>
));
Switch.displayName = 'Switch';

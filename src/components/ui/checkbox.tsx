'use client';

import * as React from 'react';
import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof RadixCheckbox.Root>,
  React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root>
>(({ className, ...rest }, ref) => (
  <RadixCheckbox.Root
    ref={ref}
    className={cn(
      'inline-grid h-5 w-5 shrink-0 place-items-center rounded-[6px]',
      'border-[1.5px] border-line-strong bg-white',
      'transition-colors duration-120 ease-out-soft',
      'data-[state=checked]:bg-brand-blue data-[state=checked]:border-brand-blue',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
      'disabled:opacity-40 disabled:pointer-events-none',
      className,
    )}
    {...rest}
  >
    <RadixCheckbox.Indicator>
      <Check className="h-3 w-3 text-white" strokeWidth={3} />
    </RadixCheckbox.Indicator>
  </RadixCheckbox.Root>
));
Checkbox.displayName = 'Checkbox';

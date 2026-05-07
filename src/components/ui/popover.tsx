'use client';

import * as React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ className, sideOffset = 6, ...rest }, ref) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-lg bg-white p-4 shadow-2 border border-line',
        'data-[state=open]:animate-fade-up',
        'outline-none',
        className,
      )}
      {...rest}
    />
  </RadixPopover.Portal>
));
PopoverContent.displayName = 'PopoverContent';

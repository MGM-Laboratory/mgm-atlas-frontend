'use client';

import * as React from 'react';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(({ className, sideOffset = 6, ...rest }, ref) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[200px] overflow-hidden rounded-lg bg-white p-1.5 shadow-2 border border-line',
        'data-[state=open]:animate-fade-up',
        className,
      )}
      {...rest}
    />
  </RadixDropdown.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Item>
>(({ className, ...rest }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-2',
      'text-[14px] text-ink outline-none',
      'data-[highlighted]:bg-surface-muted',
      'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
      className,
    )}
    {...rest}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Label>
>(({ className, ...rest }, ref) => (
  <RadixDropdown.Label
    ref={ref}
    className={cn('px-2.5 py-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3', className)}
    {...rest}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdown.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Separator>
>(({ className, ...rest }, ref) => (
  <RadixDropdown.Separator
    ref={ref}
    className={cn('my-1 h-px bg-line', className)}
    {...rest}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

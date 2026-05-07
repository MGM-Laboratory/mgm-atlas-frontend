'use client';

import * as React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(({ className, children, ...rest }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-10 w-full items-center justify-between rounded bg-white px-3.5 text-[15px] text-ink',
      'border border-line transition-[border-color,box-shadow] duration-120 ease-out-soft',
      'hover:border-line-strong',
      'focus:outline-none focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(58,109,197,0.15)]',
      'data-[placeholder]:text-ink-4',
      'disabled:bg-surface-muted disabled:text-ink-4',
      className,
    )}
    {...rest}
  >
    {children}
    <RadixSelect.Icon asChild>
      <ChevronDown className="h-4 w-4 text-ink-3" />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = 'popper', ...rest }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        'z-50 max-h-[var(--radix-select-content-available-height)] overflow-hidden rounded-lg bg-white p-1 shadow-2 border border-line',
        'min-w-[var(--radix-select-trigger-width)]',
        'data-[state=open]:animate-fade-up',
        className,
      )}
      {...rest}
    >
      <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
    </RadixSelect.Content>
  </RadixSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...rest }, ref) => (
  <RadixSelect.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-2 text-[14px] text-ink',
      'outline-none data-[highlighted]:bg-surface-muted',
      'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none',
      className,
    )}
    {...rest}
  >
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    <RadixSelect.ItemIndicator className="ml-auto">
      <Check className="h-3.5 w-3.5 text-brand-blue" />
    </RadixSelect.ItemIndicator>
  </RadixSelect.Item>
));
SelectItem.displayName = 'SelectItem';

'use client';

import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & { size?: 'sm' | 'md' | 'lg' }
>(({ className, children, size = 'md', ...rest }, ref) => {
  const sizes = {
    sm: 'max-w-[480px]',
    md: 'max-w-[560px]',
    lg: 'max-w-[720px]',
  };
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-[rgba(14,17,22,0.45)] backdrop-blur-[2px]',
          'data-[state=open]:animate-fade-in',
        )}
      />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2',
          sizes[size],
          'rounded-xl bg-white shadow-3 outline-none',
          'p-7',
          'data-[state=open]:animate-modal-in',
          className,
        )}
        {...rest}
      >
        {children}
        <RadixDialog.Close
          className={cn(
            'absolute right-3 top-3 inline-grid h-8 w-8 place-items-center rounded text-ink-3',
            'hover:bg-surface-muted hover:text-ink',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...rest }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={cn('font-display text-h2 tracking-[-0.01em] text-ink', className)}
    {...rest}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...rest }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={cn('mt-1 text-body-sm text-ink-2', className)}
    {...rest}
  />
));
DialogDescription.displayName = 'DialogDescription';

export function DialogFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...rest}
    />
  );
}

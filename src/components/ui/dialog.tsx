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
      {/* Viewport-sized scrollable wrapper. Flex centering keeps the dialog
          centered when its content fits, and lets the wrapper itself scroll
          when content is taller than the viewport — works at any browser
          zoom because it uses only percentages, no vh/svh/dvh calc. */}
      <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full items-center justify-center p-4">
          <RadixDialog.Content
            ref={ref}
            className={cn(
              'relative w-full',
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
        </div>
      </div>
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

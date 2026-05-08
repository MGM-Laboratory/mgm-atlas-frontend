'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'rounded transition-[transform,filter,background-color,border-color,box-shadow]',
    'duration-120 ease-out-soft',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:opacity-40 disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-brand-blue text-white hover:brightness-[1.06] hover:-translate-y-px active:translate-y-0 active:brightness-95',
        secondary:
          'bg-white text-ink border border-line hover:bg-surface-muted hover:border-line-strong',
        ghost: 'text-ink hover:bg-surface-muted',
        danger:
          'bg-brand-red text-white hover:brightness-[1.06] hover:-translate-y-px active:translate-y-0',
        inverse:
          'bg-surface-inverse text-white hover:brightness-110 hover:-translate-y-px active:translate-y-0',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-5 text-[15px]',
        lg: 'h-12 px-6 text-[16px]',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...rest }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
                aria-hidden="true"
              />
            ) : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };

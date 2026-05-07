import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(['rounded-lg', 'transition-[transform,box-shadow] duration-200 ease-out-soft'], {
  variants: {
    variant: {
      outlined: 'bg-white border border-line',
      tinted: 'bg-surface-muted',
      'tint-blue': 'bg-brand-blue-50',
      'tint-yellow': 'bg-brand-yellow-50',
      'tint-red': 'bg-brand-red-50',
      'tint-green': 'bg-brand-green-50',
      inverse: 'bg-surface-inverse text-white',
    },
    interactive: {
      true: 'hover:-translate-y-0.5 hover:shadow-2',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'outlined',
    interactive: false,
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, interactive, ...rest }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...rest} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...rest} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cn('px-6 py-5', className)} {...rest} />
  ),
);
CardBody.displayName = 'CardBody';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...rest }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display text-h3 tracking-[-0.005em] text-ink', className)}
      {...rest}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

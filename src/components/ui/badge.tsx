import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-full',
    'h-6 px-2.5 text-[13px] font-medium leading-none',
    'whitespace-nowrap',
  ],
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-ink-2',
        info: 'bg-brand-blue-50 text-brand-blue',
        success: 'bg-brand-green-50 text-brand-green',
        warning: 'bg-brand-yellow-50 text-brand-yellow-ink',
        danger: 'bg-brand-red-50 text-brand-red',
        outline: 'border border-line text-ink-2',
      },
      uppercase: {
        true: 'uppercase tracking-[0.08em] text-[12px]',
        false: '',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      uppercase: false,
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, uppercase, ...rest }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, uppercase }), className)} {...rest} />
  ),
);
Badge.displayName = 'Badge';

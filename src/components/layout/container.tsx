import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const SIZES = {
  xs: 'max-w-[480px]',
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
  lg: 'max-w-[1024px]',
  xl: 'max-w-[1200px]',
  '2xl': 'max-w-[1360px]',
} as const;

export const Container = React.forwardRef<HTMLDivElement, Props>(
  ({ size = 'xl', className, ...rest }, ref) => (
    <div ref={ref} className={cn('container-x mx-auto', SIZES[size], className)} {...rest} />
  ),
);
Container.displayName = 'Container';

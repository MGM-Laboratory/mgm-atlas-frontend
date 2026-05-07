'use client';

import * as React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

interface Props {
  src?: string | null;
  name: string;
  size?: 24 | 32 | 40 | 48 | 64;
  className?: string;
}

const TONE = ['bg-brand-blue-50 text-brand-blue', 'bg-brand-yellow-50 text-brand-yellow-ink', 'bg-brand-red-50 text-brand-red', 'bg-brand-green-50 text-brand-green'];

function toneFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONE[h % TONE.length];
}

export function Avatar({ src, name, size = 32, className }: Props) {
  const dim = `h-[${size}px] w-[${size}px]`;
  return (
    <RadixAvatar.Root
      className={cn('inline-grid place-items-center overflow-hidden rounded-full', dim, className)}
      style={{ height: size, width: size }}
    >
      {src ? (
        <RadixAvatar.Image src={src} alt={name} className="h-full w-full object-cover" />
      ) : null}
      <RadixAvatar.Fallback
        delayMs={src ? 200 : 0}
        className={cn(
          'inline-grid h-full w-full place-items-center text-[13px] font-medium',
          toneFor(name),
        )}
      >
        {initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
}

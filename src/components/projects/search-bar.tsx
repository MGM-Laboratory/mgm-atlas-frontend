'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/projects?q=${encodeURIComponent(q)}` as never);
  }

  return (
    <form onSubmit={onSubmit} className={cn('relative', className)} role="search">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        strokeWidth={2.25}
      />
      <input
        type="search"
        placeholder="Search projects, tags, technologies…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          'h-12 w-full rounded-full border border-line bg-white pl-11 pr-4 text-[15px] text-ink placeholder:text-ink-4',
          'transition-[border-color,box-shadow] duration-120 ease-out-soft',
          'hover:border-line-strong',
          'focus:border-brand-blue focus:outline-none focus:shadow-[0_0_0_3px_rgba(58,109,197,0.15)]',
        )}
      />
    </form>
  );
}

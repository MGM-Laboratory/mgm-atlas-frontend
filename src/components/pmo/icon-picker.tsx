'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { LUCIDE_ICON_KEYS, LucideIcon, type LucideIconKey } from './lucide-icon';

export function IconPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (key: LucideIconKey) => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LUCIDE_ICON_KEYS;
    return LUCIDE_ICON_KEYS.filter((k) => k.includes(q));
  }, [query]);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search
          strokeWidth={2.25}
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons..."
          className="pl-8"
          aria-label="Search icons"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded border border-line p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[13px] text-ink-3">No icons match.</p>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((key) => {
              const selected = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange(key)}
                  title={key}
                  aria-pressed={selected}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded transition-colors duration-120 ease-out-soft',
                    selected
                      ? 'bg-brand-blue-50 text-brand-blue ring-1 ring-brand-blue'
                      : 'text-ink-2 hover:bg-surface-muted',
                  )}
                >
                  <LucideIcon name={key} className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

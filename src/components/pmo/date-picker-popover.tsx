'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Lightweight date picker built on the browser's native `<input
 * type="date">` inside a Radix Popover. Avoids a third-party calendar
 * dep for Phase 2; we can swap in react-day-picker in Phase 5 (gantt)
 * if we need a real month-grid picker.
 *
 * `value` and `onChange` use ISO date strings (`YYYY-MM-DD`) or `null`.
 */
export function DatePickerPopover({
  value,
  onChange,
  trigger,
  label = 'Pick date',
  align = 'start',
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  trigger: React.ReactNode;
  label?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(value ?? '');
  React.useEffect(() => {
    if (open) setDraft(value ?? '');
  }, [open, value]);

  const commit = () => {
    onChange(draft || null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 space-y-3 p-3">
        <Label htmlFor="date-input" className="text-[12px]">
          {label}
        </Label>
        <Input
          id="date-input"
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-9 text-[13px]"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={commit}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Render a date string ("YYYY-MM-DD" or ISO datetime) as a human-friendly
 * relative-ish label: "Today", "Tomorrow", "Yesterday", "in 5 days",
 * "3 days ago", or "May 28" / "May 28, 2027" for further-out values.
 */
export function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${-diffDays} days ago`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

export function isOverdue(iso: string | null, completed: boolean): boolean {
  if (!iso || completed) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() < startOfDay(new Date()).getTime();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

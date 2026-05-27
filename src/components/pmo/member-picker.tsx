'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search, UserPlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { cn } from '@/lib/utils';
import type { TaskAssigneeUser } from '@/lib/types';

interface ProjectMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  title?: string | null;
  role?: 'PROJECT_MANAGER' | 'CONTRIBUTOR';
}

export function MemberPicker({
  projectSlug,
  selectedIds,
  onToggle,
  trigger,
  align = 'start',
}: {
  projectSlug: string;
  selectedIds: string[];
  onToggle: (userId: string) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const members = useQuery({
    enabled: open,
    queryKey: queryKeys.pmo.members(projectSlug, query),
    queryFn: () => api<ProjectMember[]>(apiPaths.pmo.members(projectSlug, query || undefined)),
    staleTime: 30_000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0">
        <div className="border-b border-line p-2">
          <div className="relative">
            <Search
              strokeWidth={2.25}
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team..."
              className="h-9 pl-8 text-[13px]"
              aria-label="Search members"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {members.isLoading ? (
            <div className="px-3 py-4 text-center text-[12px] text-ink-3">Loading…</div>
          ) : !members.data || members.data.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-ink-3">
              <UserPlus className="mx-auto mb-1 h-4 w-4" strokeWidth={2.25} />
              No matching members.
            </div>
          ) : (
            members.data.map((m) => {
              const selected = selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onToggle(m.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors duration-120 ease-out-soft',
                    selected ? 'bg-brand-blue-50/60' : 'hover:bg-surface-muted',
                  )}
                >
                  <Avatar src={m.avatarUrl} name={m.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{m.name}</div>
                    {m.title || m.role ? (
                      <div className="truncate text-[11px] text-ink-3">
                        {m.title ?? m.role?.toLowerCase().replace('_', ' ')}
                      </div>
                    ) : null}
                  </div>
                  {selected ? (
                    <Check className="h-4 w-4 text-brand-blue" strokeWidth={2.5} />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type AvatarSize = 24 | 28 | 32 | 36 | 40 | 48 | 64;

/** Compact avatar stack for the row's assignee cell. */
export function AssigneeStack({
  assignees,
  size = 24,
}: {
  assignees: TaskAssigneeUser[];
  size?: AvatarSize;
}) {
  if (assignees.length === 0) {
    return (
      <span className="text-[12px] text-ink-3">Unassigned</span>
    );
  }
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <span
          key={u.id}
          className="ring-2 ring-white rounded-full"
          title={u.name}
        >
          <Avatar src={u.avatarUrl} name={u.name} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="ring-2 ring-white inline-flex items-center justify-center rounded-full bg-surface-muted text-[10px] font-medium text-ink-2"
          style={{ width: size, height: size }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

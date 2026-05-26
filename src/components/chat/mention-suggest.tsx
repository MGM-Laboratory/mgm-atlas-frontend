'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMember } from '@/lib/types';

/**
 * Detects an `@…` mention trigger in the textarea, queries project
 * members, and lets the user pick one with arrow keys + Enter (or
 * click). On selection, inserts the canonical `@[Name](userId)`
 * markdown at the cursor — the backend already parses that exact
 * shape for notification recipients (P1 mention-parser).
 *
 * Lives next to the textarea (parent uses absolute positioning).
 */
interface Props {
  /** Current textarea value. */
  value: string;
  /** Live caret position in the textarea. */
  caret: number;
  projectSlug: string;
  /** Replace [start..end] in `value` with `replacement` and reposition the caret. */
  onSelect: (start: number, end: number, replacement: string) => void;
}

export interface MentionSuggestHandle {
  /** Returns true if the popover swallowed the key, so the textarea ignores it. */
  onKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Whether the popover is currently visible. */
  isOpen: boolean;
}

export const MentionSuggest = React.forwardRef<MentionSuggestHandle, Props>(function MentionSuggest(
  { value, caret, projectSlug, onSelect },
  ref,
) {
  const trigger = React.useMemo(() => findTrigger(value, caret), [value, caret]);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => setActiveIndex(0), [trigger?.query]);

  const query = useQuery({
    queryKey: ['chat', 'members', projectSlug, trigger?.query ?? ''],
    queryFn: () => api<ChatMember[]>(apiPaths.chat.members(projectSlug, trigger?.query ?? '')),
    enabled: !!trigger,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const members = query.data ?? [];

  const commit = React.useCallback(
    (m: ChatMember) => {
      if (!trigger) return;
      // Trailing space so the user can keep typing without smashing into the mention.
      const replacement = `@[${m.name}](${m.id}) `;
      onSelect(trigger.start, trigger.end, replacement);
    },
    [trigger, onSelect],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      isOpen: !!trigger,
      onKeyDown: (e) => {
        if (!trigger || members.length === 0) return false;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % members.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + members.length) % members.length);
          return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          commit(members[activeIndex]);
          return true;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          // Forces caret out of the trigger range so the popover closes.
          onSelect(trigger.start, trigger.end, value.slice(trigger.start, trigger.end));
          return true;
        }
        return false;
      },
    }),
    [trigger, members, activeIndex, commit, onSelect, value],
  );

  if (!trigger) return null;

  return (
    <div
      className="absolute bottom-full left-2 z-20 mb-1 w-[260px] overflow-hidden rounded-lg border border-line bg-white shadow-2"
      role="listbox"
    >
      {members.length === 0 ? (
        <div className="px-3 py-2 text-[12px] text-ink-3">
          {query.isLoading ? 'Searching…' : 'No matches'}
        </div>
      ) : (
        <ul className="max-h-[240px] overflow-y-auto py-1">
          {members.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => commit(m)}
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] transition-colors',
                  i === activeIndex ? 'bg-surface-muted' : 'hover:bg-surface-muted/60',
                )}
              >
                <Avatar src={m.avatarUrl} name={m.name} size={20} />
                <span className="truncate font-medium text-ink">{m.name}</span>
                {m.title ? (
                  <span className="ml-auto truncate text-[11px] text-ink-3">{m.title}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

/**
 * Walk left from the caret until whitespace or the start, returning a
 * trigger range if the run starts with `@`. The `@` itself is NOT
 * preceded by an alphanumeric character (so `email@example.com` doesn't
 * fire), matching Slack and Discord behaviour.
 */
function findTrigger(value: string, caret: number): { start: number; end: number; query: string } | null {
  if (caret === 0) return null;
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (/\s/.test(ch)) return null;
    if (ch === '@') {
      // The @ must be at start-of-text or preceded by whitespace.
      const prev = i === 0 ? ' ' : value[i - 1];
      if (!/\s/.test(prev)) return null;
      const query = value.slice(i + 1, caret);
      // Bail if the query already contains structural markdown — looks
      // like the user is past the autocomplete window.
      if (/[\]\[\(\)]/.test(query)) return null;
      return { start: i, end: caret, query };
    }
    i -= 1;
  }
  return null;
}

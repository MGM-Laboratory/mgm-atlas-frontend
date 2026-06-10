'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, Hash, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { searchHitHref, type ChatScope } from '@/lib/chat/scope';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ChatSearchHit, ChatSearchResponse } from '@/lib/types';

interface Props {
  chatScope: ChatScope;
  /** Project id for project-wide search; null for global channels. */
  projectId: string | null;
  channelId: string;
}

/**
 * Channel-local search in the chat header. The popover is rendered in
 * a Radix portal so it sits above every other header control (the
 * previous absolute-positioned version collided with the navbar
 * buttons). Click outside or hit Escape to close — Radix handles both.
 *
 * The snippet HTML comes from server-side ts_headline with
 * <mark>…</mark> wrappers; rendered through a tight sanitiser that
 * allows the mark tag only.
 */
export function ChatSearch({ chatScope, projectId, channelId }: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  // Global channels have no project to widen into — their second chip
  // searches everything the user can see ('global' API scope) instead.
  const isGlobalChannel = chatScope.kind === 'global';
  const [scope, setScope] = React.useState<'channel' | 'project' | 'global'>('channel');
  const debounced = useDebounced(q, 250);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset when the popover closes so reopening starts fresh.
  React.useEffect(() => {
    if (!open) {
      setQ('');
      setScope('channel');
    }
  }, [open]);

  // Closing on channel switch keeps stale scoping from leaking across rooms.
  React.useEffect(() => {
    setOpen(false);
  }, [channelId]);

  const query = useQuery({
    queryKey: ['chat', 'search', scope, debounced, channelId, projectId],
    queryFn: () =>
      api<ChatSearchResponse>(
        apiPaths.chat.search({
          scope,
          q: debounced.trim(),
          channelId: scope === 'channel' ? channelId : undefined,
          projectId: scope === 'project' && projectId ? projectId : undefined,
          limit: 30,
        }),
      ),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 10_000,
  });

  const hits = query.data?.hits ?? [];
  const noResults = debounced.trim().length >= 2 && !query.isLoading && hits.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Search this channel"
          className={open ? 'text-brand-blue' : undefined}
        >
          <Search className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions
        // Radix steals focus to the content by default; redirect it to
        // the input so users can just start typing.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              scope === 'channel'
                ? 'Search this channel'
                : scope === 'project'
                  ? 'Search this project'
                  : 'Search everywhere'
            }
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
          />
        </div>

        <div className="flex items-center gap-2 border-b border-line bg-surface-muted/40 px-3 py-1.5 text-[11px]">
          <span className="text-ink-3">Scope:</span>
          <ScopeChip active={scope === 'channel'} onClick={() => setScope('channel')}>
            This channel
          </ScopeChip>
          {isGlobalChannel ? (
            <ScopeChip active={scope === 'global'} onClick={() => setScope('global')}>
              Everywhere
            </ScopeChip>
          ) : (
            <ScopeChip active={scope === 'project'} onClick={() => setScope('project')}>
              Whole project
            </ScopeChip>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {debounced.trim().length < 2 ? (
            <div className="px-3 py-4 text-[12px] text-ink-3">Type at least 2 characters.</div>
          ) : query.isLoading ? (
            <div className="grid h-20 place-items-center text-ink-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : noResults ? (
            <div className="px-3 py-4 text-[12px] text-ink-3">No matches.</div>
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <SearchHitRow
                  key={h.id}
                  hit={h}
                  onPick={() => setOpen(false)}
                  showProject={scope !== 'channel'}
                />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-2 py-0.5 transition-colors',
        active ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-2 hover:bg-white',
      )}
    >
      {children}
    </button>
  );
}

interface SearchHitRowProps {
  hit: ChatSearchHit;
  onPick: () => void;
  showProject: boolean;
}

export function SearchHitRow({ hit, onPick, showProject }: SearchHitRowProps) {
  // The hit itself knows where it lives — global-channel hits have no
  // projectSlug and route to /chat/global/… instead.
  return (
    <li>
      <Link
        href={`${searchHitHref(hit.projectSlug, hit.channelId)}?msg=${hit.id}` as never}
        onClick={onPick}
        className="block px-3 py-2 transition-colors hover:bg-surface-muted/60"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
          {showProject ? (
            <>
              <span className="truncate font-medium text-ink-2">
                {hit.projectTitle ?? 'Workspace'}
              </span>
              <span>·</span>
            </>
          ) : null}
          <Hash className="h-3 w-3" strokeWidth={2.25} />
          <span className="truncate">{hit.channelName}</span>
          <span>·</span>
          <span className="truncate">{hit.authorName}</span>
          <span className="ml-auto whitespace-nowrap">
            {new Date(hit.createdAt).toLocaleDateString()}
          </span>
        </div>
        <SnippetHTML html={hit.snippet} className="mt-0.5 text-[13px] text-ink" />
      </Link>
    </li>
  );
}

/**
 * Tiny sanitiser: strip everything except <mark>…</mark> from the
 * server-supplied snippet. Server already escapes the rest via
 * ts_headline; we belt-and-braces by replacing any other angle
 * brackets so the only HTML that survives is our highlight wrapper.
 */
export function SnippetHTML({ html, className }: { html: string; className?: string }) {
  const safe = React.useMemo(() => {
    // Escape every < / > except ones that wrap <mark> or </mark>.
    const placeholderOpen = 'MARKO';
    const placeholderClose = 'MARKC';
    const protectedStr = html
      .replace(/<mark>/g, placeholderOpen)
      .replace(/<\/mark>/g, placeholderClose);
    const escaped = protectedStr.replace(/[<>&]/g, (c) =>
      c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;',
    );
    return escaped
      .replaceAll(placeholderOpen, '<mark class="rounded bg-brand-yellow-50 px-0.5">')
      .replaceAll(placeholderClose, '</mark>');
  }, [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

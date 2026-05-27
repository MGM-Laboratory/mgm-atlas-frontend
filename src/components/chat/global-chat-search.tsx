'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, Hash, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SnippetHTML } from './chat-search';
import type { ChatSearchHit, ChatSearchResponse } from '@/lib/types';

interface Props {
  /** When provided, replaces the default trigger. */
  trigger?: React.ReactNode;
  /** External open control — used to wire ⌘K from the navbar shortcut. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Global cross-project chat search. Backend enforces the access ACL
 * so admins see everything, non-admins see only projects they belong
 * to. Hits are grouped by project → channel for visual scannability.
 *
 * Opens via the trigger prop or controlled via open/onOpenChange.
 * The chat nav button wires this to ⌘K and the "View all" link.
 */
export function GlobalChatSearch({ trigger, open: controlledOpen, onOpenChange }: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const [q, setQ] = React.useState('');
  const debounced = useDebounced(q, 250);

  React.useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const query = useQuery({
    queryKey: ['chat', 'search', 'global', debounced],
    queryFn: () =>
      api<ChatSearchResponse>(
        apiPaths.chat.search({ scope: 'global', q: debounced.trim(), limit: 50 }),
      ),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 10_000,
  });

  const grouped = React.useMemo(() => groupByProject(query.data?.hits ?? []), [query.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <Search className="h-4 w-4" strokeWidth={2.25} />
            Search chats
          </Button>
        </DialogTrigger>
      )}
      <DialogContent size="lg" className="max-h-[80vh] overflow-hidden p-0">
        {/* Reserve room on the right for the Dialog's built-in close (h-8 w-8 at right-3 top-3). */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 pr-14">
          <Search className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search every chat you have access to…"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {debounced.trim().length < 2 ? (
            <div className="px-3 py-6 text-center text-[13px] text-ink-3">
              Type at least 2 characters to search across all your projects.
            </div>
          ) : query.isLoading ? (
            <div className="grid h-32 place-items-center text-ink-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-ink-3">
              No matches across {''}your projects.
            </div>
          ) : (
            <ul className="space-y-3">
              {grouped.map((p) => (
                <li key={p.projectId}>
                  <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                    {p.projectTitle}
                  </div>
                  <ul className="space-y-1">
                    {p.hits.map((h) => (
                      <GlobalHit key={h.id} hit={h} onPick={() => setOpen(false)} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GlobalHit({ hit, onPick }: { hit: ChatSearchHit; onPick: () => void }) {
  return (
    <li>
      <Link
        href={`/projects/${hit.projectSlug}/chat/${hit.channelId}?msg=${hit.id}` as never}
        onClick={onPick}
        className="block rounded px-3 py-2 transition-colors hover:bg-surface-muted/60"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
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

interface ProjectGroup {
  projectId: string;
  projectTitle: string;
  hits: ChatSearchHit[];
}

function groupByProject(hits: ChatSearchHit[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const h of hits) {
    const group = map.get(h.projectId);
    if (group) {
      group.hits.push(h);
    } else {
      map.set(h.projectId, {
        projectId: h.projectId,
        projectTitle: h.projectTitle,
        hits: [h],
      });
    }
  }
  return [...map.values()];
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

'use client';

import * as React from 'react';
import { Forward, Hash, Loader2, Search } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatOverviewPayload, ChatProjectOverview } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  message: ChatMessage;
}

/**
 * Forward a message into another channel. Lists every channel across
 * every project the user has chat access to (deduped against the
 * current location), with a search-as-you-type filter. Uses the
 * existing POST /chat/messages/:id/forward endpoint, which copies
 * markdown + attachments and sets `forwardedFromId` so the recipient
 * sees the provenance tag.
 */
export function ForwardDialog({ open, onClose, message }: Props) {
  const [q, setQ] = React.useState('');
  const [selectedChannelId, setSelectedChannelId] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<{ href: string; channelName: string } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQ('');
      setSelectedChannelId(null);
      setSent(null);
    }
  }, [open]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.chat.myProjects,
    queryFn: () => api<ChatOverviewPayload>(apiPaths.chat.myProjects()),
    enabled: open,
    staleTime: 30_000,
  });

  // Present workspace-global channels as a pseudo-project group at the
  // top — the forward endpoint takes a bare channelId either way.
  const projects = React.useMemo(() => {
    const payload = overviewQuery.data;
    if (!payload) return [];
    const groups = [...payload.projects];
    if (payload.workspace && payload.workspace.channels.length > 0) {
      groups.unshift({
        id: WORKSPACE_GROUP_ID,
        slug: WORKSPACE_GROUP_ID,
        title: 'Workspace',
        thumbnailUrl: null,
        updatedAt: '',
        channels: payload.workspace.channels,
        unread: payload.workspace.unread,
      });
    }
    return groups;
  }, [overviewQuery.data]);

  const filtered = React.useMemo(
    () => filterProjects(projects, q, message.channelId),
    [projects, q, message.channelId],
  );

  const forwardMutation = useMutation({
    mutationFn: () => {
      if (!selectedChannelId) throw new Error('Pick a channel.');
      return api(apiPaths.chat.forwardMessage(message.id), {
        method: 'POST',
        body: { targetChannelId: selectedChannelId },
      });
    },
    onSuccess: () => {
      const target = findChannel(projects, selectedChannelId);
      if (target) setSent(target);
      // Auto-close after a brief success state.
      setTimeout(onClose, 1400);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent size="md" className="overflow-hidden p-0">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Forward className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
          <h2 className="flex-1 font-display text-h3 text-ink">Forward message</h2>
        </header>

        {sent ? (
          <div className="px-4 py-10 text-center text-[14px]">
            <div className="font-medium text-brand-green">
              Forwarded to #{sent.channelName}.
            </div>
            <a
              href={sent.href}
              className="text-[12px] text-brand-blue underline-offset-2 hover:underline"
            >
              Open conversation
            </a>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-3 py-2">
              <div className="flex items-center gap-2 rounded border border-line bg-white px-2 py-1.5 focus-within:border-line-strong">
                <Search className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find a project or channel"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
                />
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {overviewQuery.isLoading ? (
                <div className="grid h-32 place-items-center text-ink-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-3">No matches.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((p) => (
                    <li key={p.id} className="px-2 py-2">
                      <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
                        {p.title}
                      </div>
                      <ul className="space-y-0.5">
                        {p.channels.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedChannelId(c.id)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition-colors',
                                selectedChannelId === c.id
                                  ? 'bg-brand-blue/10 text-brand-blue'
                                  : 'text-ink-2 hover:bg-surface-muted/60 hover:text-ink',
                              )}
                            >
                              <Hash className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
                              <span className="truncate">{c.name}</span>
                              {c.id === message.channelId ? (
                                <span className="ml-auto text-[10px] text-ink-3">current</span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
              {forwardMutation.isError ? (
                <span className="mr-auto text-[12px] text-brand-red">
                  {(forwardMutation.error as { body?: { message?: string } })?.body?.message ??
                    'Forward failed.'}
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => forwardMutation.mutate()}
                disabled={!selectedChannelId || forwardMutation.isPending}
                loading={forwardMutation.isPending}
              >
                <Forward className="h-3.5 w-3.5" strokeWidth={2.25} />
                Forward
              </Button>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function filterProjects(
  projects: ChatProjectOverview[],
  q: string,
  excludeChannelId: string,
): ChatProjectOverview[] {
  const needle = q.trim().toLowerCase();
  return projects
    .map((p) => ({
      ...p,
      channels: p.channels.filter(
        (c) =>
          c.id !== excludeChannelId &&
          (!needle ||
            p.title.toLowerCase().includes(needle) ||
            c.name.toLowerCase().includes(needle)),
      ),
    }))
    .filter((p) => p.channels.length > 0);
}

const WORKSPACE_GROUP_ID = '@workspace';

function findChannel(
  projects: ChatProjectOverview[],
  channelId: string | null,
): { href: string; channelName: string } | null {
  if (!channelId) return null;
  for (const p of projects) {
    const c = p.channels.find((c) => c.id === channelId);
    if (c) {
      return {
        href:
          p.id === WORKSPACE_GROUP_ID ? `/chat/global/${c.id}` : `/projects/${p.slug}/chat/${c.id}`,
        channelName: c.name,
      };
    }
  }
  return null;
}

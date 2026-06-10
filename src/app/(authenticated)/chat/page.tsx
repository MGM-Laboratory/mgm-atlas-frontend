'use client';

import * as React from 'react';
import Link from 'next/link';
import { Globe, Hash, MessagesSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Container } from '@/components/layout/container';
import type { ChatOverviewPayload, ChatWorkspaceOverview } from '@/lib/types';

/**
 * Global chat home. Workspace-wide channels first (visible to everyone),
 * then every project the user has chat access to, each with its
 * channels and unread counts.
 */
export default function ChatHomePage() {
  const query = useQuery({
    queryKey: queryKeys.chat.myProjects,
    queryFn: () => api<ChatOverviewPayload>(apiPaths.chat.myProjects()),
    refetchInterval: 10_000,
    refetchOnWindowFocus: false,
  });

  const projects = query.data?.projects ?? [];
  const workspace = query.data?.workspace;

  return (
    <Container size="2xl" className="space-y-8 py-10">
      <header className="space-y-2">
        <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">Chat</h1>
        <p className="max-w-prose text-body-lg text-ink-2">
          Workspace-wide channels, plus every project you have access to.
        </p>
      </header>

      {workspace && workspace.channels.length > 0 ? (
        <WorkspaceCard workspace={workspace} />
      ) : null}

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg bg-line/50" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface-muted/50 px-6 py-16 text-center">
          <MessagesSquare className="h-8 w-8 text-ink-3" strokeWidth={2.25} />
          <div className="text-[15px] font-medium text-ink">No project chats yet</div>
          <p className="max-w-sm text-[13px] text-ink-3">
            Join or create a project to start chatting with the team.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const general = p.channels.find((c) => c.isGeneral) ?? p.channels[0];
            return (
              <li
                key={p.id}
                className="overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-1"
              >
                <Link href={`/projects/${p.slug}/chat/${general?.id ?? ''}` as never}>
                  <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded bg-surface-muted text-ink-3">
                        <Hash className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{p.title}</div>
                      <div className="text-[12px] text-ink-3">
                        {p.channels.length} {p.channels.length === 1 ? 'channel' : 'channels'}
                      </div>
                    </div>
                    {p.unread > 0 ? (
                      <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-medium text-white">
                        {p.unread}
                      </span>
                    ) : null}
                  </div>
                </Link>
                <ul className="divide-y divide-line">
                  {p.channels.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/projects/${p.slug}/chat/${c.id}` as never}
                        className="flex items-center gap-2 px-4 py-2 text-[13px] text-ink-2 hover:bg-surface-muted hover:text-ink"
                      >
                        <Hash className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
                        <span className="flex-1 truncate">{c.name}</span>
                        {c.unread > 0 ? (
                          <span className="text-[11px] font-medium text-brand-blue">
                            {c.unread}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}

/**
 * Workspace section — visually distinct from the project cards (blue
 * leading color + Globe) because these channels belong to everyone,
 * not to a project.
 */
function WorkspaceCard({ workspace }: { workspace: ChatWorkspaceOverview }) {
  return (
    <section className="overflow-hidden rounded-lg border border-brand-blue/30 bg-white">
      <div className="flex items-center gap-3 border-b border-line bg-brand-blue/5 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded bg-brand-blue/10 text-brand-blue">
          <Globe className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-ink">Workspace</div>
          <div className="text-[12px] text-ink-3">Channels shared with everyone</div>
        </div>
        {workspace.unread > 0 ? (
          <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-brand-blue px-1.5 text-[11px] font-medium text-white">
            {workspace.unread}
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-line">
        {workspace.channels.map((c) => (
          <li key={c.id}>
            <Link
              href={`/chat/global/${c.id}` as never}
              className="flex items-center gap-2 px-4 py-2 text-[13px] text-ink-2 hover:bg-surface-muted hover:text-ink"
            >
              <Hash className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
              <span className="flex-1 truncate">{c.name}</span>
              {c.unread > 0 ? (
                <span className="text-[11px] font-medium text-brand-blue">{c.unread}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

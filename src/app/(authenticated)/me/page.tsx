'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { DashboardPayload, SessionUser } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProjectThumbnail, PhaseBadge } from '@/components/projects/project-thumbnail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/utils';

export default function MyDashboardPage() {
  const [me, setMe] = useState<SessionUser & { lastLoginAt?: string; bio?: string | null } | null>(null);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [meData, dashData] = await Promise.all([
          api<SessionUser & { lastLoginAt?: string; bio?: string | null }>(apiPaths.me()),
          api<DashboardPayload>(apiPaths.dashboard()),
        ]);
        setMe(meData);
        setDash(dashData);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading || !me || !dash) {
    return (
      <Container size="2xl" className="space-y-10 py-10">
        <div className="h-40 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  return (
    <Container size="2xl" className="space-y-10 py-10">
      <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar src={me.avatarUrl} name={me.name} size={64} />
          <div>
            <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">{me.name}</h1>
            <p className="text-body-sm text-ink-2">{me.email}</p>
            {me.isAdmin ? (
              <Badge tone="info" className="mt-2">
                Admin
              </Badge>
            ) : null}
          </div>
        </div>
        <Button asChild>
          <Link href={'/projects/new'}>
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            New project
          </Link>
        </Button>
      </header>

      <Tabs defaultValue="managing">
        <TabsList>
          <TabsTrigger value="managing">
            Managing
            <span className="ml-1 text-ink-3">{dash.managed.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contributing">
            Contributing
            <span className="ml-1 text-ink-3">{dash.contributing.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <span className="ml-1 text-ink-3">{dash.pendingRequests.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bookmarks">
            Saved
            <span className="ml-1 text-ink-3">{dash.bookmarks.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="managing">
          {dash.managed.length === 0 ? (
            <EmptyState
              title="You aren't managing any projects yet."
              description="Start one and you'll automatically be its first project manager."
              action={
                <Button asChild>
                  <Link href={'/projects/new'}>
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                    Start a project
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dash.managed.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.slug}/manage`}
                  className="group block"
                >
                  <ProjectThumbnail
                    thumbnailUrl={p.thumbnailUrl}
                    thumbnailType={p.thumbnailType}
                    alt={p.title}
                  />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-[16px] font-semibold text-ink">
                        {p.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">
                        {p.shortDescription}
                      </p>
                    </div>
                    <PhaseBadge phase={p.phase} />
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-[12px] text-ink-3">
                    <Settings2 className="h-3 w-3" strokeWidth={2.25} />
                    Manage
                  </span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contributing">
          {dash.contributing.length === 0 ? (
            <EmptyState
              title="Not contributing to anything yet."
              description="Browse projects and request to join the ones that match your skills."
              action={
                <Button asChild variant="secondary">
                  <Link href={'/projects'}>Browse projects</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dash.contributing.map((p) => (
                <Link key={p.id} href={`/projects/${p.slug}`} className="group block">
                  <ProjectThumbnail
                    thumbnailUrl={p.thumbnailUrl}
                    thumbnailType={p.thumbnailType}
                    alt={p.title}
                  />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h3 className="truncate font-display text-[16px] font-semibold text-ink">
                      {p.title}
                    </h3>
                    <PhaseBadge phase={p.phase} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{p.shortDescription}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {dash.pendingRequests.length === 0 ? (
            <EmptyState title="No pending requests." />
          ) : (
            <ul className="space-y-3">
              {dash.pendingRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-white p-5"
                >
                  <div className="flex-1">
                    <Link
                      href={`/projects/${r.project.slug}`}
                      className="font-display text-[16px] font-semibold text-ink hover:text-brand-blue"
                    >
                      {r.project.title}
                    </Link>
                    <p className="mt-1 text-[13px] text-ink-2">
                      Applied as <span className="font-medium text-ink">{r.role}</span> ·{' '}
                      {formatRelative(r.createdAt)}
                    </p>
                    {r.message ? (
                      <p className="mt-2 line-clamp-2 text-[13px] text-ink-3">{r.message}</p>
                    ) : null}
                  </div>
                  <Badge tone="warning" uppercase>
                    Pending
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="bookmarks">
          {dash.bookmarks.length === 0 ? (
            <EmptyState
              title="Nothing saved."
              description="Tap the bookmark icon on any project to find it again here."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {dash.bookmarks.map((p) => (
                <Link key={p.id} href={`/projects/${p.slug}`} className="group block">
                  <ProjectThumbnail
                    thumbnailUrl={p.thumbnailUrl}
                    thumbnailType={p.thumbnailType}
                    alt={p.title}
                  />
                  <h3 className="mt-3 truncate font-display text-[16px] font-semibold text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{p.shortDescription}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Container>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Archive, Settings2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import { isInsider, type ProjectDetail, type ProjectDetailInsider, type TaskList } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pmoBgClass, pmoFgClass } from '@/components/pmo/color-picker';
import { ListNavbar } from '@/components/pmo/list-navbar';
import { ListSettingsDialog } from '@/components/pmo/list-settings-dialog';
import { LucideIcon } from '@/components/pmo/lucide-icon';

export default function TaskListLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;
  const pmoEnabled = isPmoEnabled();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const project = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.project(slug),
    queryFn: () => api<ProjectDetail>(apiPaths.project(slug)),
  });

  const list = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.pmo.list(slug, listId),
    queryFn: () => api<TaskList>(apiPaths.pmo.lists.one(slug, listId)),
  });

  if (!pmoEnabled) {
    return (
      <Container size="2xl" className="py-12">
        <p className="text-ink-2">PMO is not enabled on this deploy.</p>
      </Container>
    );
  }

  if (project.isLoading || list.isLoading) {
    return (
      <div>
        <div className="border-b border-line bg-surface">
          <Container size="2xl" className="py-6">
            <div className="h-8 w-72 animate-pulse rounded bg-line" />
          </Container>
        </div>
      </div>
    );
  }

  if (project.isError || !project.data || list.isError || !list.data) {
    return (
      <Container size="2xl" className="py-12">
        <p className="text-brand-red">Could not load this task list.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={`/projects/${slug}` as never}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to project
          </Link>
        </Button>
      </Container>
    );
  }

  const insider = isInsider(project.data) ? (project.data as ProjectDetailInsider) : null;
  if (!insider) {
    return (
      <Container size="2xl" className="py-12">
        <p className="text-ink-2">Task lists are only available to project members.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={`/projects/${slug}` as never}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to project
          </Link>
        </Button>
      </Container>
    );
  }

  const canManage = project.data.access.isManager;
  const data = list.data;

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col">
      {/* List header */}
      <div className="border-b border-line bg-surface">
        <Container size="2xl" className="py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/projects/${slug}` as never}
                className="inline-grid h-8 w-8 place-items-center rounded text-ink-3 hover:bg-surface-muted hover:text-ink"
                aria-label="Back to project"
                title="Back to project"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
              </Link>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded ${pmoBgClass(data.iconColor)}`}
                aria-hidden
              >
                <LucideIcon name={data.iconName} className={`h-5 w-5 ${pmoFgClass(data.iconColor)}`} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-h2 tracking-[-0.01em] text-ink">
                  {data.name}
                </h1>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  {project.data.title}
                  {data.projectKey ? (
                    <>
                      {' · '}
                      <code className="text-ink-2">{data.projectKey}</code>
                    </>
                  ) : null}
                </p>
              </div>
              {data.archivedAt ? (
                <Badge tone="warning" uppercase>
                  <Archive className="mr-1 h-3 w-3" strokeWidth={2.25} />
                  Archived
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {canManage ? (
                <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4" strokeWidth={2.25} />
                  Settings
                </Button>
              ) : null}
            </div>
          </div>
        </Container>
      </div>

      {/* Local tab navbar */}
      <ListNavbar projectSlug={slug} list={data} canManage={canManage} />

      {/* Tab content */}
      <div className="flex-1 bg-surface">
        <Container size="2xl" className="py-8">
          {children}
        </Container>
      </div>

      {canManage ? (
        <ListSettingsDialog
          projectSlug={slug}
          list={data}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import { ApiError } from '@/lib/api/error';
import { isInsider, type CollaborationRole, type ProjectDetail, type ProjectDetailInsider, type Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EditProjectForm } from '@/components/projects/manage/edit-form';
import { ContributionRequestsList } from '@/components/projects/manage/requests-list';
import { TeamPanel } from '@/components/projects/manage/team-panel';
import { DangerZone } from '@/components/projects/manage/danger-zone';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export const metadata: Metadata = { title: 'Manage' };

export default async function ManageProjectPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab = 'overview' } = await searchParams;

  let project: ProjectDetail;
  try {
    project = await api<ProjectDetail>(apiPaths.project(slug));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  if (!isInsider(project) || !project.access.isManager) {
    redirect(`/projects/${slug}`);
  }
  const insider = project as ProjectDetailInsider;

  const [grouped, roles] = await Promise.all([
    api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
    api<CollaborationRole[]>(apiPaths.collaborationRoles()),
  ]);

  const pending = insider.pendingRequestCount ?? 0;

  return (
    <Container size="2xl" className="space-y-8 py-10">
      <header>
        <span className="text-[13px] font-medium text-ink-3">{insider.title}</span>
        <h1 className="mt-1 font-display text-display-lg tracking-[-0.02em] text-ink">
          Manage
        </h1>
      </header>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            Requests
            {pending > 0 ? <Badge tone="info">{pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <EditProjectForm project={insider} groupedTags={grouped} collaborationRoles={roles} />
        </TabsContent>

        <TabsContent value="requests">
          <ContributionRequestsList projectSlug={slug} />
        </TabsContent>

        <TabsContent value="team">
          <TeamPanel project={insider} collaborationRoles={roles} />
        </TabsContent>

        <TabsContent value="settings">
          <DangerZone project={insider} />
        </TabsContent>
      </Tabs>
    </Container>
  );
}

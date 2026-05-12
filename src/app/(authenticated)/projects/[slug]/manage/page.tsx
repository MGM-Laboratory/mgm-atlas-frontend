'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { isInsider, type CollaborationRole, type ProjectDetail, type ProjectDetailInsider, type Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EditProjectForm } from '@/components/projects/manage/edit-form';
import { ContributionRequestsList } from '@/components/projects/manage/requests-list';
import { TeamPanel } from '@/components/projects/manage/team-panel';
import { DangerZone } from '@/components/projects/manage/danger-zone';

export default function ManageProjectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [project, setProject] = useState<ProjectDetailInsider | null>(null);
  const [grouped, setGrouped] = useState<{ category: string; items: Tag[] }[] | null>(null);
  const [roles, setRoles] = useState<CollaborationRole[] | null>(null);
  const [loading, setLoading] = useState(true);

  const tab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const projectData = await api<ProjectDetail>(apiPaths.project(slug));
        
        if (!isInsider(projectData) || !projectData.access.isManager) {
          router.push(`/projects/${slug}`);
          return;
        }

        const [tagsData, rolesData] = await Promise.all([
          api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
          api<CollaborationRole[]>(apiPaths.collaborationRoles()),
        ]);

        setProject(projectData as ProjectDetailInsider);
        setGrouped(tagsData);
        setRoles(rolesData);
      } catch (err) {
        console.error('Failed to fetch project:', err);
        router.push(`/projects/${slug}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, router]);

  if (loading || !project || !grouped || !roles) {
    return (
      <Container size="2xl" className="space-y-8 py-10">
        <div className="h-40 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  const pending = project.pendingRequestCount ?? 0;

  return (
    <Container size="2xl" className="space-y-8 py-10">
      <header>
        <span className="text-[13px] font-medium text-ink-3">{project.title}</span>
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
          <EditProjectForm project={project} groupedTags={grouped} collaborationRoles={roles} />
        </TabsContent>

        <TabsContent value="requests">
          <ContributionRequestsList projectSlug={slug} />
        </TabsContent>

        <TabsContent value="team">
          <TeamPanel project={project} collaborationRoles={roles} />
        </TabsContent>

        <TabsContent value="settings">
          <DangerZone project={project} />
        </TabsContent>
      </Tabs>
    </Container>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import type { DiscoveryPayload } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { DiscoveryHero } from '@/components/projects/hero';
import { ProjectRow } from '@/components/projects/project-row';
import { PendingRequestsRow } from '@/components/projects/pending-requests-row';
import { GlobalSearchBar } from '@/components/projects/search-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Discover' };

export default async function DashboardPage() {
  const data = await api<DiscoveryPayload>(apiPaths.discovery());

  const hasMyProjects =
    data.myProjects.managed.length > 0 || data.myProjects.contributing.length > 0;
  const hasContent =
    hasMyProjects ||
    data.pendingRequests.length > 0 ||
    data.rows.some((r) => r.items.length > 0);

  return (
    <>
      <DiscoveryHero items={data.hero} />

      <Container size="2xl" className="space-y-12 py-12">
        <GlobalSearchBar className="mx-auto max-w-[720px]" />

        {hasMyProjects ? (
          <>
            {data.myProjects.managed.length > 0 ? (
              <ProjectRow
                label="Projects you manage"
                description="You're a project manager — full access."
                items={data.myProjects.managed}
                viewAllHref="/me"
              />
            ) : null}
            {data.myProjects.contributing.length > 0 ? (
              <ProjectRow
                label="You're contributing to"
                items={data.myProjects.contributing}
                viewAllHref="/me"
              />
            ) : null}
          </>
        ) : null}

        {data.pendingRequests.length > 0 ? (
          <PendingRequestsRow items={data.pendingRequests} />
        ) : null}

        {data.rows.map((row) => (
          <ProjectRow
            key={row.key}
            label={row.label}
            items={row.items}
            viewAllHref={`/projects?row=${row.key}`}
          />
        ))}

        {!hasContent ? (
          <EmptyState
            title="It's quiet here for now."
            description="Be the first to share what you're working on. Your project will appear in everyone's feed."
            action={
              <Button asChild size="lg">
                <Link href={'/projects/new' as never}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Start a project
                </Link>
              </Button>
            }
          />
        ) : null}
      </Container>
    </>
  );
}

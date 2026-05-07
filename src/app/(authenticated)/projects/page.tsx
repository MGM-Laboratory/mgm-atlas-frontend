import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole, Paginated, ProjectCard, Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { ProjectCard as ProjectCardView } from '@/components/projects/project-card';
import { GlobalSearchBar } from '@/components/projects/search-bar';
import { FilterPanel } from '@/components/projects/filter-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Projects' };

interface PageProps {
  searchParams: Promise<{
    q?: string;
    phase?: string;
    tagIds?: string;
    recruitingFor?: string;
    bookmarkedOnly?: string;
    page?: string;
    sort?: string;
  }>;
}

export default async function ProjectsBrowsePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const path = apiPaths.projects({
    q: sp.q,
    phase: sp.phase ? sp.phase.split(',') : undefined,
    tagIds: sp.tagIds ? sp.tagIds.split(',') : undefined,
    recruitingFor: sp.recruitingFor,
    bookmarkedOnly: sp.bookmarkedOnly === 'true',
    page: sp.page ? Number(sp.page) : 1,
    sort: sp.sort,
  });

  const [data, grouped, roles] = await Promise.all([
    api<Paginated<ProjectCard>>(path),
    api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
    api<CollaborationRole[]>(apiPaths.collaborationRoles()),
  ]);

  const page = data.meta.page;
  const totalPages = data.meta.totalPages;

  return (
    <Container size="2xl" className="space-y-8 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">
          Browse projects
        </h1>
        <p className="max-w-prose text-body text-ink-2">
          {sp.q ? <>Showing results for <span className="font-medium text-ink">&ldquo;{sp.q}&rdquo;</span>.</> : 'Find what the lab is working on. Filter by phase, tags, or open roles.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex-1">
          <GlobalSearchBar />
        </div>
        <FilterPanel groupedTags={grouped} collaborationRoles={roles} />
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          title="No projects match those filters."
          description="Try removing a filter or starting a new project of your own."
          action={
            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link href={'/projects' as never}>Clear filters</Link>
              </Button>
              <Button asChild>
                <Link href={'/projects/new' as never}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Start a project
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p) => (
              <ProjectCardView key={p.id} project={p} width={undefined as unknown as number} static />
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} qs={await searchParams} />
          ) : null}
        </>
      )}
    </Container>
  );
}

function Pagination({
  page,
  totalPages,
  qs,
}: {
  page: number;
  totalPages: number;
  qs: Awaited<PageProps['searchParams']>;
}) {
  const linkFor = (target: number) => {
    const next = new URLSearchParams();
    Object.entries(qs).forEach(([k, v]) => {
      if (k === 'page' || !v) return;
      next.set(k, v as string);
    });
    next.set('page', String(target));
    return `/projects?${next.toString()}` as never;
  };

  return (
    <nav className="flex items-center justify-between border-t border-line pt-6" aria-label="Pagination">
      <span className="text-[13px] text-ink-3">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="sm" disabled={page <= 1}>
          <Link href={linkFor(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            Previous
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" disabled={page >= totalPages}>
          <Link href={linkFor(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next
          </Link>
        </Button>
      </div>
    </nav>
  );
}

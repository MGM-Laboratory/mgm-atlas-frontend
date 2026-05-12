'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole, Paginated, ProjectCard, Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { ProjectCard as ProjectCardView } from '@/components/projects/project-card';
import { GlobalSearchBar } from '@/components/projects/search-bar';
import { FilterPanel } from '@/components/projects/filter-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

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

export default function ProjectsBrowsePage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Paginated<ProjectCard> | null>(null);
  const [grouped, setGrouped] = useState<{ category: string; items: Tag[] }[] | null>(null);
  const [roles, setRoles] = useState<CollaborationRole[] | null>(null);
  const [loading, setLoading] = useState(true);

  const q = searchParams.get('q') || undefined;
  const phase = searchParams.get('phase') ? searchParams.get('phase')!.split(',') : undefined;
  const tagIds = searchParams.get('tagIds') ? searchParams.get('tagIds')!.split(',') : undefined;
  const recruitingFor = searchParams.get('recruitingFor') || undefined;
  const bookmarkedOnly = searchParams.get('bookmarkedOnly') === 'true';
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const sort = searchParams.get('sort') || undefined;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const path = apiPaths.projects({
          q,
          phase,
          tagIds,
          recruitingFor,
          bookmarkedOnly,
          page,
          sort,
        });

        const [projectsData, tagsData, rolesData] = await Promise.all([
          api<Paginated<ProjectCard>>(path),
          api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
          api<CollaborationRole[]>(apiPaths.collaborationRoles()),
        ]);

        setData(projectsData);
        setGrouped(tagsData);
        setRoles(rolesData);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [q, phase, tagIds, recruitingFor, bookmarkedOnly, page, sort]);

  if (loading || !data || !grouped || !roles) {
    return (
      <Container size="2xl" className="space-y-8 py-12">
        <div className="h-40 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  const totalPages = data.meta.totalPages;

  return (
    <Container size="2xl" className="space-y-8 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">
          Browse projects
        </h1>
        <p className="max-w-prose text-body text-ink-2">
          {q ? <>Showing results for <span className="font-medium text-ink">&ldquo;{q}&rdquo;</span>.</> : 'Find what the lab is working on. Filter by phase, tags, or open roles.'}
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
                <Link href={'/projects'}>Clear filters</Link>
              </Button>
              <Button asChild>
                <Link href={'/projects/new'}>
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                  Start a project
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p) => (
              <ProjectCardView key={p.id} project={p} static />
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
          ) : null}
        </>
      )}
    </Container>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const linkFor = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('page', String(target));
    return `/projects?${next.toString()}`;
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

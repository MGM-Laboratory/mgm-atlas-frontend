'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ProjectThumbnail } from '@/components/projects/project-thumbnail';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { Paginated, ProjectCard } from '@/lib/types';

export function FeaturedManager() {
  const qc = useQueryClient();
  const { show } = useToast();
  const [search, setSearch] = React.useState('');

  const featured = useQuery({
    queryKey: ['featured'],
    queryFn: () =>
      api<Array<{ projectId: string; project: ProjectCard; order: number }>>(apiPaths.featured()),
  });

  const projects = useQuery({
    queryKey: ['projects', 'admin-search', search],
    queryFn: () =>
      api<Paginated<ProjectCard>>(apiPaths.projects({ q: search, pageSize: 12 })),
    enabled: search.length >= 2,
  });

  const [order, setOrder] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (featured.data) setOrder(featured.data.map((f) => f.projectId));
  }, [featured.data]);

  const save = useMutation({
    mutationFn: () =>
      api('/projects/featured', { method: 'POST', body: { projectIds: order } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['featured'] });
      qc.invalidateQueries({ queryKey: ['discovery'] });
      show({ tone: 'success', title: 'Featured projects updated' });
    },
  });

  const featuredProjects = featured.data ?? [];
  const featuredById = new Map(featuredProjects.map((f) => [f.projectId, f.project]));

  function remove(id: string) {
    setOrder((prev) => prev.filter((x) => x !== id));
  }
  function add(p: ProjectCard) {
    if (order.includes(p.id)) return;
    if (order.length >= 12) {
      show({ tone: 'warning', title: 'You can feature up to 12 projects.' });
      return;
    }
    featuredById.set(p.id, p);
    setOrder((prev) => [...prev, p.id]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">Featured projects</h2>
        <p className="mt-1 text-body-sm text-ink-2">
          The top of the discover dashboard. Up to 12 projects in your chosen order.
        </p>
      </div>

      {featured.isLoading ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : order.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-muted p-8 text-center text-[14px] text-ink-3">
          Search below to add projects to the hero.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {order.map((id, idx) => {
            const p = featuredById.get(id);
            if (!p) return null;
            return (
              <li
                key={id}
                className="relative overflow-hidden rounded-lg border border-line bg-white"
              >
                <div className="relative">
                  <ProjectThumbnail
                    thumbnailUrl={p.thumbnailUrl}
                    thumbnailType={p.thumbnailType}
                    alt={p.title}
                  />
                  <span className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-white/90 px-2.5 text-[12px] font-medium text-ink">
                    <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" />
                    {idx + 1}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="truncate text-[14px] font-medium text-ink">{p.title}</span>
                  <button
                    onClick={() => remove(id)}
                    aria-label="Remove from featured"
                    className="text-ink-3 hover:text-brand-red"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={search}
            placeholder="Find a project to feature"
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {projects.data?.items.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  disabled={order.includes(p.id)}
                  className="flex w-full items-start gap-3 rounded-lg border border-line bg-white p-3 text-left hover:border-brand-blue disabled:opacity-50"
                >
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-surface-muted">
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{p.title}</div>
                    <div className="truncate text-[12px] text-ink-3">{p.shortDescription}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save featured order
        </Button>
      </div>
    </div>
  );
}

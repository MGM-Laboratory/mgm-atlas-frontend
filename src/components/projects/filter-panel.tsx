'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProjectPhase, Tag } from '@/lib/types';
import { PROJECT_PHASE_LABEL } from '@/lib/types';

const PHASES: ProjectPhase[] = [
  'IDEA',
  'PLANNING',
  'IN_DEVELOPMENT',
  'IN_REVIEW',
  'SHIPPED',
  'ARCHIVED',
];

interface Props {
  groupedTags: { category: string; items: Tag[] }[];
  collaborationRoles: { id: string; name: string }[];
}

export function FilterPanel({ groupedTags, collaborationRoles }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const phaseParam = params.get('phase');
  const tagParam = params.get('tagIds');
  const recruitingFor = params.get('recruitingFor');
  const bookmarkedOnly = params.get('bookmarkedOnly') === 'true';

  const phases = phaseParam ? phaseParam.split(',') : [];
  const tagIds = tagParam ? tagParam.split(',') : [];
  const activeCount =
    phases.length + tagIds.length + (recruitingFor ? 1 : 0) + (bookmarkedOnly ? 1 : 0);

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    router.push(`/projects${next.toString() ? `?${next}` : ''}` as never);
  }

  function togglePhase(p: ProjectPhase) {
    const next = phases.includes(p) ? phases.filter((x) => x !== p) : [...phases, p];
    set('phase', next.length ? next.join(',') : null);
  }

  function toggleTag(id: string) {
    const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id];
    set('tagIds', next.length ? next.join(',') : null);
  }

  function clearAll() {
    router.push('/projects' as never);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="md">
          <Filter className="h-4 w-4" strokeWidth={2.25} />
          Filters
          {activeCount > 0 ? (
            <Badge tone="info" className="ml-1 h-5 min-w-[20px] justify-center">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] max-w-[calc(100vw-32px)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[14px] font-medium text-ink">Filters</span>
          {activeCount > 0 ? (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-red hover:underline"
            >
              <X className="h-3 w-3" strokeWidth={2.25} />
              Clear all
            </button>
          ) : null}
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-4">
          <div>
            <h4 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Phase
            </h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {PHASES.map((p) => (
                <label key={p} className="inline-flex cursor-pointer items-center gap-2">
                  <Checkbox checked={phases.includes(p)} onCheckedChange={() => togglePhase(p)} />
                  <span className="text-[14px] text-ink">{PROJECT_PHASE_LABEL[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Tags
            </h4>
            <div className="space-y-3">
              {groupedTags.map((g) => (
                <div key={g.category}>
                  <span className="text-[12px] font-medium text-ink-3">{g.category}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.items.map((t) => {
                      const active = tagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTag(t.id)}
                          className={cn(
                            'inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors',
                            active
                              ? 'bg-brand-blue text-white'
                              : 'bg-surface-muted text-ink-2 hover:bg-line',
                          )}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Recruiting for
            </h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {collaborationRoles.map((r) => (
                <label key={r.id} className="inline-flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={recruitingFor === r.name}
                    onCheckedChange={(c) => set('recruitingFor', c ? r.name : null)}
                  />
                  <span className="text-[13px] text-ink">{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-[14px] font-medium text-ink">Bookmarked only</span>
                <span className="block text-[12px] text-ink-3">Show projects I&apos;ve saved.</span>
              </div>
              <Switch
                checked={bookmarkedOnly}
                onCheckedChange={(c) => set('bookmarkedOnly', c ? 'true' : null)}
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

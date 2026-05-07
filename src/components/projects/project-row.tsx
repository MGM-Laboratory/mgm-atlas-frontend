import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ScrollRow } from '@/components/ui/scroll-row';
import { ProjectCard } from './project-card';
import type { ProjectCard as ProjectCardData } from '@/lib/types';

interface Props {
  label: string;
  description?: string;
  items: ProjectCardData[];
  /** Optional view-all destination. */
  viewAllHref?: string;
}

export function ProjectRow({ label, description, items, viewAllHref }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-h2 tracking-[-0.01em] text-ink">{label}</h2>
          {description ? <p className="mt-1 text-body-sm text-ink-2">{description}</p> : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref as never}
            className="group inline-flex items-center gap-1 text-[14px] font-medium text-brand-blue"
          >
            View all
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={2.25}
            />
          </Link>
        ) : null}
      </div>

      <ScrollRow ariaLabel={label}>
        {items.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </ScrollRow>
    </section>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PatternCorner } from '@/components/brand/pattern-corner';
import { PhaseBadge } from './project-thumbnail';
import { Container } from '@/components/layout/container';
import type { ProjectCard as ProjectCardData } from '@/lib/types';

export function DiscoveryHero({ items }: { items: ProjectCardData[] }) {
  const [idx, setIdx] = React.useState(0);
  const safeItems = items.slice(0, 5);

  React.useEffect(() => {
    if (safeItems.length <= 1) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % safeItems.length), 9000);
    return () => window.clearInterval(id);
  }, [safeItems.length]);

  if (safeItems.length === 0) return <DiscoveryHeroEmpty />;

  const featured = safeItems[idx];

  return (
    <section className="relative overflow-hidden">
      <PatternCorner position="top-right" size={3} cellSize={64} className="opacity-95" />

      <Container size="2xl" className="relative pb-16 pt-24 md:pt-32 lg:pb-24 lg:pt-40">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 text-eyebrow text-brand-blue">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-blue" />
              Featured
            </span>

            <AnimatePresence mode="wait">
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="mt-3 font-display text-display-2xl tracking-[-0.025em] text-ink">
                  {featured.title}
                </h1>
                <p className="mt-4 max-w-prose text-body-lg text-ink-2">
                  {featured.shortDescription}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <PhaseBadge phase={featured.phase} />
                  {featured.tags.slice(0, 4).map((t) => (
                    <Badge key={t.id} tone="info">
                      {t.name}
                    </Badge>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link href={`/projects/${featured.slug}` as never}>
                      View project
                      <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
                    </Link>
                  </Button>
                  {featured.collaborationRoles.length > 0 ? (
                    <Button asChild size="lg" variant="secondary">
                      <Link href={`/projects/${featured.slug}?contribute=1` as never}>
                        Contribute
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative aspect-[5/4] overflow-hidden rounded-xl bg-surface-muted shadow-2"
              >
                {featured.thumbnailUrl ? (
                  featured.thumbnailType === 'VIDEO' ? (
                    <video
                      key={featured.thumbnailUrl}
                      src={featured.thumbnailUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={featured.thumbnailUrl}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 480px"
                      className="object-cover"
                      priority
                    />
                  )
                ) : null}
              </motion.div>
            </AnimatePresence>

            {safeItems.length > 1 ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setIdx((i) => (i - 1 + safeItems.length) % safeItems.length)}
                  className="inline-grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 hover:bg-surface-muted"
                  aria-label="Previous featured project"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
                </button>
                <div className="flex flex-1 gap-1.5">
                  {safeItems.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setIdx(i)}
                      aria-label={`Show ${p.title}`}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i === idx ? 'bg-ink' : 'bg-line'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setIdx((i) => (i + 1) % safeItems.length)}
                  className="inline-grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 hover:bg-surface-muted"
                  aria-label="Next featured project"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

function DiscoveryHeroEmpty() {
  return (
    <section className="relative overflow-hidden">
      <PatternCorner position="top-right" size={3} cellSize={64} />
      <Container size="2xl" className="pb-16 pt-24 md:pt-32">
        <div className="max-w-prose">
          <span className="text-eyebrow text-brand-blue">MGM Atlas</span>
          <h1 className="mt-3 font-display text-display-2xl tracking-[-0.025em] text-ink">
            Discover what the lab is{' '}
            <span className="text-brand-blue">building</span>.
          </h1>
          <p className="mt-4 text-body-lg text-ink-2">
            Browse active projects, find a team that needs your skills, or start something new.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={'/projects/new' as never}>Start a project</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={'/projects' as never}>Browse projects</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

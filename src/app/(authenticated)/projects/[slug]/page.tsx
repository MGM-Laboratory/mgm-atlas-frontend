import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  ExternalLink,
  Figma,
  GitBranch,
  Globe,
  KanbanSquare,
  Settings2,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import { ApiError } from '@/lib/api/error';
import { isInsider, type ProjectDetail, type ProjectDetailInsider, type SessionUser } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MediaHero } from '@/components/projects/media-hero';
import { PhaseBadge } from '@/components/projects/project-thumbnail';
import { ContributeModal } from '@/components/projects/contribute-modal';
import { BookmarkButton } from '@/components/projects/bookmark-button';
import { RichTextEditor } from '@/components/rich-text/editor';
import { PROJECT_PHASE_LABEL } from '@/lib/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = await api<ProjectDetail>(apiPaths.project(slug));
    return { title: project.title, description: project.shortDescription };
  } catch {
    return { title: 'Project' };
  }
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let project: ProjectDetail;
  try {
    project = await api<ProjectDetail>(apiPaths.project(slug));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const me = await api<SessionUser>(apiPaths.session()).catch(() => null);
  const insider = isInsider(project) ? (project as ProjectDetailInsider) : null;

  return (
    <>
      <Container size="2xl" className="space-y-10 py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Link
              href={'/projects' as never}
              className="text-[13px] font-medium text-ink-3 hover:text-ink"
            >
              ← All projects
            </Link>
            <h1 className="mt-4 font-display text-display-lg tracking-[-0.02em] text-ink">
              {project.title}
            </h1>
            <p className="mt-3 max-w-prose text-body-lg text-ink-2">{project.shortDescription}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <PhaseBadge phase={project.phase} />
              {project.tags.map((t) => (
                <Badge key={t.id} tone="neutral">
                  {t.name}
                </Badge>
              ))}
              {project.archivedAt ? (
                <Badge tone="warning" uppercase>
                  Archived
                </Badge>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {project.collaborationRoles.length > 0 && project.access.level !== 'admin' && project.access.level !== 'manager' && project.access.level !== 'contributor' ? (
                <Button asChild size="lg">
                  <Link href={`/projects/${project.slug}?contribute=1` as never}>
                    Contribute to this project
                  </Link>
                </Button>
              ) : null}
              {project.access.isManager ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/projects/${project.slug}/manage` as never}>
                    <Settings2 className="h-4 w-4" strokeWidth={2.25} />
                    Manage
                  </Link>
                </Button>
              ) : null}
              <BookmarkButton projectId={project.id} />
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-4 rounded-lg border border-line p-5">
              <Section title="Owner">
                <div className="flex items-center gap-3">
                  <Avatar src={project.owner.avatarUrl} name={project.owner.name} size={40} />
                  <div>
                    <div className="text-[14px] font-medium text-ink">{project.owner.name}</div>
                    {insider ? (
                      <div className="text-[12px] text-ink-3">{insider.ownerEmail}</div>
                    ) : null}
                  </div>
                </div>
              </Section>

              {project.managers.length > 0 ? (
                <Section title="Project managers">
                  <ul className="space-y-2">
                    {project.managers.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5">
                        <Avatar src={m.avatarUrl} name={m.name} size={28} />
                        <span className="text-[13px] text-ink">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="Team">
                <span className="inline-flex items-center gap-1.5 text-[14px] text-ink">
                  <Users className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
                  {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
                </span>
              </Section>

              {project.collaborationRoles.length > 0 ? (
                <Section title="Recruiting for">
                  <div className="flex flex-wrap gap-1.5">
                    {project.collaborationRoles.map((r) => (
                      <Badge key={r} tone="info">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </Section>
              ) : null}

              <Section title="Phase">
                <span className="text-[14px] text-ink">{PROJECT_PHASE_LABEL[project.phase]}</span>
              </Section>
            </div>
          </aside>
        </div>

        <MediaHero media={project.media} title={project.title} />

        <div className="grid gap-10 lg:grid-cols-12">
          <article className="lg:col-span-8">
            <h2 className="mb-4 font-display text-h2 tracking-[-0.01em] text-ink">About</h2>
            <RichTextEditor value={project.description as object} editable={false} />

            {project.techStack.length > 0 ? (
              <section className="mt-10">
                <h2 className="mb-4 font-display text-h2 tracking-[-0.01em] text-ink">
                  Tech stack
                </h2>
                <div className="flex flex-wrap gap-2">
                  {project.techStack.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className="lg:col-span-4">
            {insider ? (
              <div className="space-y-6 rounded-lg border border-line bg-white p-5">
                <Section title="Internal links">
                  {insider.internalLinks ? <InternalLinks links={insider.internalLinks} /> : (
                    <span className="text-[13px] text-ink-3">No links yet.</span>
                  )}
                </Section>

                <Section title={`Members (${insider.members.length})`}>
                  <ul className="space-y-2">
                    {insider.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2.5">
                        <Avatar src={m.user.avatarUrl} name={m.user.name} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">
                            {m.user.name}
                          </div>
                          <div className="truncate text-[12px] text-ink-3">
                            {m.title ?? m.role.toLowerCase().replace('_', ' ')}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Section>
              </div>
            ) : (
              <div className="rounded-lg border border-line bg-surface-muted p-5 text-[13px] text-ink-3">
                Internal links and the full member list are visible to team members only.
              </div>
            )}
          </aside>
        </div>
      </Container>

      {project.collaborationRoles.length > 0 && me && project.access.level !== 'admin' && project.access.level !== 'manager' && project.access.level !== 'contributor' ? (
        <ContributeModal
          projectSlug={project.slug}
          projectTitle={project.title}
          collaborationRoles={project.collaborationRoles}
          user={{ name: me.name, email: me.email }}
        />
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InternalLinks({
  links,
}: {
  links: NonNullable<ProjectDetailInsider['internalLinks']>;
}) {
  const items: { key: string; href: string; label: string; icon: React.ReactNode }[] = [];
  if (links.pmTool)
    items.push({
      key: 'pmTool',
      href: links.pmTool,
      label: 'Project board',
      icon: <KanbanSquare className="h-3.5 w-3.5" strokeWidth={2.25} />,
    });
  if (links.repository)
    items.push({
      key: 'repo',
      href: links.repository,
      label: 'Repository',
      icon: <GitBranch className="h-3.5 w-3.5" strokeWidth={2.25} />,
    });
  if (links.staging)
    items.push({
      key: 'staging',
      href: links.staging,
      label: 'Staging',
      icon: <Globe className="h-3.5 w-3.5" strokeWidth={2.25} />,
    });
  if (links.designs)
    items.push({
      key: 'designs',
      href: links.designs,
      label: 'Design files',
      icon: <Figma className="h-3.5 w-3.5" strokeWidth={2.25} />,
    });
  if (items.length === 0)
    return <span className="text-[13px] text-ink-3">No links yet.</span>;
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.key}>
          <a
            href={it.href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 text-[13px] text-ink hover:text-brand-blue"
          >
            <span className="text-ink-3 group-hover:text-brand-blue">{it.icon}</span>
            <span className="font-medium">{it.label}</span>
            <ArrowUpRight
              className="h-3 w-3 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={2.25}
            />
            <span aria-hidden className="sr-only">
              Opens in new tab
              <ExternalLink className="hidden" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

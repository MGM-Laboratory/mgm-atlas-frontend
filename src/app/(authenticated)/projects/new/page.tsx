import type { Metadata } from 'next';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole, Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { NewProjectWizard } from '@/components/projects/new/wizard';

export const metadata: Metadata = { title: 'New project' };

export default async function NewProjectPage() {
  const [grouped, roles] = await Promise.all([
    api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
    api<CollaborationRole[]>(apiPaths.collaborationRoles()),
  ]);

  return (
    <Container size="lg" className="py-12">
      <div className="mb-8">
        <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">
          Start a project
        </h1>
        <p className="mt-2 max-w-prose text-body text-ink-2">
          Five short steps. You&apos;ll be the project manager, and people across the lab can
          discover and request to contribute.
        </p>
      </div>
      <NewProjectWizard groupedTags={grouped} collaborationRoles={roles} />
    </Container>
  );
}

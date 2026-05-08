'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type { CollaborationRole, Tag } from '@/lib/types';
import { Container } from '@/components/layout/container';
import { NewProjectWizard } from '@/components/projects/new/wizard';

export default function NewProjectPage() {
  const [grouped, setGrouped] = useState<{ category: string; items: Tag[] }[] | null>(null);
  const [roles, setRoles] = useState<CollaborationRole[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tagsData, rolesData] = await Promise.all([
          api<{ category: string; items: Tag[] }[]>(apiPaths.tagsGrouped()),
          api<CollaborationRole[]>(apiPaths.collaborationRoles()),
        ]);
        setGrouped(tagsData);
        setRoles(rolesData);
      } catch (err) {
        console.error('Failed to fetch project data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading || !grouped || !roles) {
    return (
      <Container size="lg" className="py-12">
        <div className="h-40 animate-pulse rounded bg-line" />
      </Container>
    );
  }

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

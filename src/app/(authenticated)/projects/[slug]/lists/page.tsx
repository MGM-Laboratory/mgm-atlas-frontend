'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ListTodo } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import type { TaskList } from '@/lib/types';

export default function TaskListsIndexPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const pmoEnabled = isPmoEnabled();

  const lists = useQuery({
    enabled: pmoEnabled,
    queryKey: queryKeys.pmo.lists(slug),
    queryFn: () => api<TaskList[]>(apiPaths.pmo.lists.list(slug)),
  });

  React.useEffect(() => {
    if (!lists.data) return;
    const firstActive = lists.data.find((l) => !l.archivedAt);
    if (firstActive) {
      router.replace(`/projects/${slug}/lists/${firstActive.id}` as never);
    }
  }, [lists.data, slug, router]);

  if (!pmoEnabled) {
    return (
      <Container size="2xl" className="py-12">
        <h1 className="font-display text-h1 text-ink">Task lists</h1>
        <p className="mt-3 text-ink-2">PMO is not enabled on this deploy.</p>
      </Container>
    );
  }

  if (lists.isLoading) {
    return (
      <Container size="2xl" className="py-12">
        <div className="h-12 w-48 animate-pulse rounded bg-line" />
      </Container>
    );
  }

  if (lists.isError) {
    return (
      <Container size="2xl" className="py-12">
        <h1 className="font-display text-h1 text-ink">Task lists</h1>
        <p className="mt-3 text-brand-red">Could not load task lists.</p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={`/projects/${slug}` as never}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to project
          </Link>
        </Button>
      </Container>
    );
  }

  // No lists at all → empty state with link back.
  return (
    <Container size="2xl" className="py-16">
      <div className="mx-auto max-w-prose text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-ink-3">
          <ListTodo className="h-6 w-6" strokeWidth={2.25} />
        </div>
        <h1 className="font-display text-h1 text-ink">No task lists yet</h1>
        <p className="mt-3 text-ink-2">
          Task lists group work for a role on this project. Open the project page and use the “+”
          next to <strong>Task lists</strong> in the sidebar to create one.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href={`/projects/${slug}` as never}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            Back to project
          </Link>
        </Button>
      </div>
    </Container>
  );
}

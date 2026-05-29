'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import { EmbedView } from '@/components/pmo/views/embed-view';
import type { TaskList } from '@/lib/types';

export default function EmbedTabPage() {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;
  const tabId = params.tabId as string;
  const enabled = isPmoEnabled();

  const list = useQuery({
    enabled,
    queryKey: queryKeys.pmo.list(slug, listId),
    queryFn: () => api<TaskList>(apiPaths.pmo.lists.one(slug, listId)),
  });

  if (!enabled) return <p className="text-ink-2">PMO is not enabled on this deploy.</p>;
  if (list.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-3">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
      </div>
    );
  }

  const tab = list.data?.tabs.find((t) => t.id === tabId);
  if (!tab || tab.kind !== 'EMBED' || !tab.url) {
    return <p className="text-ink-3">This embed tab no longer exists.</p>;
  }

  return <EmbedView url={tab.url} label={tab.label ?? 'Embed'} />;
}

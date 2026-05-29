'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import type { SessionUser } from '@/lib/types';

const WhiteboardCanvas = dynamic(
  () => import('@/components/pmo/whiteboard-canvas').then((m) => m.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-ink-3">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
      </div>
    ),
  },
);

export default function WhiteboardPage() {
  const params = useParams();
  const slug = params.slug as string;
  const listId = params.listId as string;
  const wbId = params.wbId as string;

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<SessionUser>(apiPaths.me()),
    staleTime: 5 * 60 * 1000,
  });

  if (!isPmoEnabled()) return <p className="text-ink-2">PMO is not enabled on this deploy.</p>;

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[480px] flex-col">
      <Link
        href={`/projects/${slug}/lists/${listId}/whiteboards`}
        className="mb-2 inline-flex w-fit items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} /> Back to whiteboards
      </Link>
      {me.data ? (
        <WhiteboardCanvas projectSlug={slug} wbId={wbId} user={me.data} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-ink-3">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
        </div>
      )}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import { WhiteboardsView } from '@/components/pmo/views/whiteboards-view';

export default function WhiteboardsPage() {
  const slug = useParams().slug as string;
  if (!isPmoEnabled()) return <p className="text-ink-2">PMO is not enabled on this deploy.</p>;
  return <WhiteboardsView projectSlug={slug} />;
}

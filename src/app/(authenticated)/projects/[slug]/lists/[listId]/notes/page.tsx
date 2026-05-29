'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { isPmoEnabled } from '@/lib/hooks/use-pmo-enabled';
import { NotesView } from '@/components/pmo/views/notes-view';

export default function NotesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const pmoEnabled = isPmoEnabled();

  if (!pmoEnabled) return <p className="text-ink-2">PMO is not enabled on this deploy.</p>;
  return <NotesView projectSlug={slug} />;
}

'use client';

import * as React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';

export function BookmarkButton({
  projectId,
  bookmarked: initialBookmarked = false,
}: {
  projectId: string;
  bookmarked?: boolean;
}) {
  const { show } = useToast();
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);

  // Sync if the server-provided value changes (e.g. after navigation/refresh).
  React.useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      api(apiPaths.bookmark(projectId), { method: next ? 'POST' : 'DELETE' }),
    onMutate: (next) => {
      setBookmarked(next);
    },
    onError: (_err, next) => {
      setBookmarked(!next);
      show({ tone: 'danger', title: 'Could not save bookmark.' });
    },
  });

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => toggle.mutate(!bookmarked)}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? 'Remove from saved projects' : 'Save project'}
    >
      {bookmarked ? (
        <BookmarkCheck className="h-4 w-4 text-brand-blue" strokeWidth={2.25} />
      ) : (
        <Bookmark className="h-4 w-4" strokeWidth={2.25} />
      )}
      {bookmarked ? 'Saved' : 'Save'}
    </Button>
  );
}

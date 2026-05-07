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

  const toggle = useMutation({
    mutationFn: () =>
      api(apiPaths.bookmark(projectId), { method: bookmarked ? 'DELETE' : 'POST' }),
    onMutate: () => setBookmarked((b) => !b),
    onError: () => {
      setBookmarked((b) => !b);
      show({ tone: 'danger', title: 'Could not save bookmark.' });
    },
  });

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => toggle.mutate()}
      aria-pressed={bookmarked}
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

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">
          Something went wrong
        </h1>
        <p className="text-body-sm text-ink-2">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest ? (
          <p className="text-[12px] text-ink-4">Error ID: {error.digest}</p>
        ) : null}
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}

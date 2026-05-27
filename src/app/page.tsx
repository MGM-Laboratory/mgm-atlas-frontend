'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { useAuthCallback } from '@/lib/hooks/use-auth-callback';

function RootPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasSessionParam = searchParams.get('session') != null;

  // If we arrived from the OAuth callback, useAuthCallback will parse the
  // `?session=` blob, write it to localStorage, and push to the destination.
  // We must NOT race it with our own redirect — at render time the session
  // hasn't been stored yet, so getStoredSession() would return null and bounce
  // the user to /login, forcing a second sign-in click.
  useAuthCallback();

  useEffect(() => {
    if (hasSessionParam) return;
    const session = getStoredSession();
    router.replace(session ? '/dashboard' : '/login');
  }, [hasSessionParam, router]);

  return null;
}

export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <RootPageContent />
    </Suspense>
  );
}

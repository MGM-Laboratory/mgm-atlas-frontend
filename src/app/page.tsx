'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { useAuthCallback } from '@/lib/hooks/use-auth-callback';

function RootPageContent() {
  const router = useRouter();
  const session = getStoredSession();

  // Handle OAuth callback and store session
  useAuthCallback();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [session, router]);

  return null;
}

export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <RootPageContent />
    </Suspense>
  );
}

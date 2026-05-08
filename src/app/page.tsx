'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { useAuthCallback } from '@/lib/hooks/use-auth-callback';

export default function RootPage() {
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

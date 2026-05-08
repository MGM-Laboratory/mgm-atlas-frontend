'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { storeSession } from '@/lib/auth-client';

/**
 * Hook to handle OAuth callback and store session in localStorage
 */
export function useAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam) {
      try {
        const sessionData = JSON.parse(sessionParam);
        storeSession({
          ...sessionData,
          expiresAt: new Date(sessionData.expiresAt),
        });

        // Remove session from URL
        window.history.replaceState({}, '', window.location.pathname);

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (error) {
        console.error('Failed to parse session:', error);
        router.push('/login?error=invalid_session_data');
      }
    }
  }, [searchParams, router]);
}

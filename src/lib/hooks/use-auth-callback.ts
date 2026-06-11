'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { storeSession } from '@/lib/auth-client';
import { sanitizeReturnTo } from '@/lib/auth-redirect';

/**
 * Handles the post-Keycloak return: parses the session blob from the URL,
 * stores it in localStorage, then sends the user to the page they were
 * trying to reach (or the dashboard).
 */
export function useAuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam) return;

    try {
      const sessionData = JSON.parse(sessionParam);
      storeSession({
        ...sessionData,
        expiresAt: new Date(sessionData.expiresAt),
      });

      window.history.replaceState({}, '', window.location.pathname);

      const fromQuery = searchParams.get('callback_url');
      const fromSession =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('auth_callback')
          : null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('auth_callback');
      }
      // Both sources are user-controllable — sanitize at consumption
      // so neither can become an open redirect.
      const target =
        sanitizeReturnTo(fromQuery) ?? sanitizeReturnTo(fromSession) ?? '/dashboard';
      router.push(target as never);
    } catch (error) {
      console.error('Failed to parse session:', error);
      router.push('/login?error=invalid_session_data');
    }
  }, [searchParams, router]);
}

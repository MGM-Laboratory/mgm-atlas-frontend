'use client';

import { useCallback } from 'react';
import { buildKeycloakAuthUrl } from '@/lib/auth-client';
import { sanitizeReturnTo } from '@/lib/auth-redirect';
import { Button } from '@/components/ui/button';

interface LoginClientProps {
  callbackUrl?: string;
}

export function LoginClient({ callbackUrl }: LoginClientProps) {
  const handleLogin = useCallback(() => {
    try {
      // Stash the post-login destination in sessionStorage — it
      // survives the Keycloak round-trip (same tab, same origin) and
      // use-auth-callback reads it back after the session is stored.
      // Sanitized here AND at consumption so a crafted /login link
      // can't smuggle an external redirect in.
      const safeCallback = sanitizeReturnTo(callbackUrl);
      if (safeCallback && typeof window !== 'undefined') {
        sessionStorage.setItem('auth_callback', safeCallback);
      }

      // Redirect to Keycloak login
      const authUrl = buildKeycloakAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to build Keycloak auth URL:', error);
      alert(`Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [callbackUrl]);

  return (
    <div className="mt-6">
      <Button onClick={handleLogin} size="lg" className="w-full">
        Continue with Keycloak
      </Button>
    </div>
  );
}

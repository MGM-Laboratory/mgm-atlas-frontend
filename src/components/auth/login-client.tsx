'use client';

import { useCallback } from 'react';
import { buildKeycloakAuthUrl } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

interface LoginClientProps {
  callbackUrl?: string;
}

export function LoginClient({ callbackUrl }: LoginClientProps) {
  const handleLogin = useCallback(() => {
    // Store callback URL for after authentication
    if (callbackUrl && typeof window !== 'undefined') {
      sessionStorage.setItem('auth_callback', callbackUrl);
    }

    // Redirect to Keycloak login
    const authUrl = buildKeycloakAuthUrl();
    window.location.href = authUrl;
  }, [callbackUrl]);

  return (
    <div className="mt-6">
      <Button onClick={handleLogin} size="lg" className="w-full">
        Continue with Keycloak
      </Button>
    </div>
  );
}

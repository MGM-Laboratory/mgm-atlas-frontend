import { NextRequest, NextResponse } from 'next/server';
import { extractUserFromIdToken } from '@/lib/auth-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callback_url') || '/dashboard';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Helper to construct redirect URLs using the configured app URL
  const createRedirectUrl = (path: string, errorCode?: string) => {
    if (!appUrl) {
      console.error('Missing NEXT_PUBLIC_APP_URL');
      return new URL('/login', request.url); // Fallback
    }
    const url = new URL(path, appUrl);
    if (errorCode) {
      url.searchParams.set('error', errorCode);
    }
    return url;
  };

  // Handle Keycloak errors
  if (error) {
    return NextResponse.redirect(createRedirectUrl('/login', error));
  }

  if (!code || !state) {
    return NextResponse.redirect(createRedirectUrl('/login', 'missing_parameters'));
  }

  try {
    const keycloakIssuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/callback`;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      `${keycloakIssuer}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
        }),
        cache: 'no-store',
      },
    );

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(createRedirectUrl('/login', 'token_exchange_failed'));
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    // Extract user info from ID token
    const userInfo = tokenData.id_token
      ? extractUserFromIdToken(tokenData.id_token)
      : null;

    if (!userInfo) {
      return NextResponse.redirect(createRedirectUrl('/login', 'invalid_id_token'));
    }

    // Call backend to create a session
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    
    if (!backendUrl) {
      console.error('Missing NEXT_PUBLIC_API_URL environment variable');
      return NextResponse.redirect(createRedirectUrl('/login', 'missing_api_url'));
    }

    console.log('Calling backend session creation:', {
      url: `${backendUrl}/auth/login`,
      userInfo,
    });

    const sessionResponse = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keycloakId: userInfo.keycloakId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
      }),
      cache: 'no-store',
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('Session creation failed:', {
        status: sessionResponse.status,
        error: errorText,
      });
      return NextResponse.redirect(createRedirectUrl('/login', 'session_creation_failed'));
    }

    const sessionData = (await sessionResponse.json()) as {
      sessionId: string;
      expiresAt: string;
      user: {
        id: string;
        keycloakId: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        isAdmin: boolean;
      };
    };

    // Redirect to root page with session data
    // The root page's useAuthCallback hook will extract and store in localStorage
    const redirectUrl = new URL('/', appUrl);
    redirectUrl.searchParams.set('session', JSON.stringify(sessionData));
    // Preserve callback URL for final redirect
    if (callbackUrl !== '/dashboard') {
      redirectUrl.searchParams.set('callback_url', callbackUrl);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(createRedirectUrl('/login', 'internal_error'));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { extractUserFromIdToken, verifyState } from '@/lib/auth-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callback_url') || '/dashboard';

  // Handle Keycloak errors
  if (error) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', error);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(url);
  }

  // Verify state parameter for CSRF protection
  if (!state || !verifyState(state)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'invalid_state');
    return NextResponse.redirect(url);
  }

  try {
    const keycloakIssuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
    const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;

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
      const url = new URL('/login', request.url);
      url.searchParams.set('error', 'token_exchange_failed');
      return NextResponse.redirect(url);
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
      const url = new URL('/login', request.url);
      url.searchParams.set('error', 'invalid_id_token');
      return NextResponse.redirect(url);
    }

    // Call backend to create a session
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
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
      console.error('Session creation failed:', await sessionResponse.text());
      const url = new URL('/login', request.url);
      url.searchParams.set('error', 'session_creation_failed');
      return NextResponse.redirect(url);
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

    // Redirect to the callback URL with session data
    // Frontend will extract and store in localStorage
    const redirectUrl = new URL(callbackUrl, request.url);
    redirectUrl.searchParams.set('session', JSON.stringify(sessionData));

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'internal_error');
    return NextResponse.redirect(url);
  }
}

import { NextRequest, NextResponse } from 'next/server';

interface KeycloakIdTokenClaims {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
}

function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const callbackUrl = searchParams.get('callback_url') || '/dashboard';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const createRedirectUrl = (path: string, errorCode?: string) => {
    if (!appUrl) {
      console.error('Missing NEXT_PUBLIC_APP_URL');
      return new URL('/login', request.url);
    }
    const url = new URL(path, appUrl);
    if (errorCode) {
      url.searchParams.set('error', errorCode);
    }
    return url;
  };

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
      const detail = await tokenResponse.text();
      console.error('Token exchange failed:', detail);
      const url = createRedirectUrl('/login', 'token_exchange_failed');
      url.searchParams.set('error_status', String(tokenResponse.status));
      url.searchParams.set('error_detail', detail.slice(0, 240));
      return NextResponse.redirect(url);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!backendUrl) {
      console.error('Missing NEXT_PUBLIC_API_URL environment variable');
      return NextResponse.redirect(createRedirectUrl('/login', 'missing_api_url'));
    }

    // The backend's /auth/login endpoint requires the user's identity claims
    // up-front (it doesn't validate the access token via JWKS — it trusts that
    // we just exchanged the code at Keycloak). Pull claims from the ID token,
    // and fall back to /userinfo if the ID token is absent or empty.
    let claims: KeycloakIdTokenClaims = tokenData.id_token
      ? decodeJwtPayload<KeycloakIdTokenClaims>(tokenData.id_token) ?? {}
      : {};

    if (!claims.email || !claims.sub) {
      try {
        const userinfoRes = await fetch(
          `${keycloakIssuer}/protocol/openid-connect/userinfo`,
          {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            cache: 'no-store',
          },
        );
        if (userinfoRes.ok) {
          const ui = (await userinfoRes.json()) as KeycloakIdTokenClaims;
          claims = { ...ui, ...claims };
        } else {
          console.warn(
            'Keycloak userinfo lookup failed:',
            userinfoRes.status,
            userinfoRes.statusText,
          );
        }
      } catch (err) {
        console.warn('Keycloak userinfo request errored:', err);
      }
    }

    if (!claims.sub || !claims.email) {
      const url = createRedirectUrl('/login', 'missing_identity_claims');
      url.searchParams.set(
        'error_detail',
        'The Keycloak ID token and userinfo response are both missing the sub or email claim. Enable the email/profile mappers on the atlas-web client.',
      );
      return NextResponse.redirect(url);
    }

    const fullName = [claims.given_name, claims.family_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const displayName =
      claims.name || fullName || claims.preferred_username || claims.email;

    const loginResponse = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keycloakId: claims.sub,
        email: claims.email,
        name: displayName,
        picture: claims.picture,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        idToken: tokenData.id_token,
      }),
      cache: 'no-store',
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('Session creation failed:', {
        status: loginResponse.status,
        url: `${backendUrl}/auth/login`,
        error: errorText,
      });
      const url = createRedirectUrl('/login', 'session_creation_failed');
      url.searchParams.set('error_status', String(loginResponse.status));
      url.searchParams.set('error_detail', errorText.slice(0, 240));
      return NextResponse.redirect(url);
    }

    const loginData = (await loginResponse.json()) as {
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

    const sessionData = {
      sessionId: loginData.sessionId,
      expiresAt: loginData.expiresAt,
      user: loginData.user,
    };

    const redirectUrl = new URL('/', appUrl);
    redirectUrl.searchParams.set('session', JSON.stringify(sessionData));
    if (callbackUrl !== '/dashboard') {
      redirectUrl.searchParams.set('callback_url', callbackUrl);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(createRedirectUrl('/login', 'internal_error'));
  }
}

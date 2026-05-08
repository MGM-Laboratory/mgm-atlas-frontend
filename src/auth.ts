import NextAuth, { type DefaultSession } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    error?: 'RefreshAccessTokenError';
    user: {
      id?: string;
      isAdmin?: boolean;
    } & DefaultSession['user'];
  }
}

type AppJWT = {
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  idToken?: string;
  error?: 'RefreshAccessTokenError';
} & Record<string, unknown>;

async function refreshAccessToken(token: { refreshToken?: string }) {
  if (!token.refreshToken) return null;

  const issuer = process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/+$/, '');
  const clientId = process.env.AUTH_KEYCLOAK_ID!;
  const clientSecret = process.env.AUTH_KEYCLOAK_SECRET!;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: token.refreshToken,
  });

  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    id_token?: string;
  };

  return {
    accessToken: data.access_token,
    accessTokenExpires: Date.now() + data.expires_in * 1000 - 30_000,
    refreshToken: data.refresh_token ?? token.refreshToken,
    idToken: data.id_token,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER?.replace(/\/+$/, ''),
      authorization: { params: { scope: 'openid profile email' } },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token: rawToken, account }) {
      const token = rawToken as AppJWT;

      if (account && account.access_token) {
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          accessTokenExpires:
            (account.expires_at ?? 0) * 1000 || Date.now() + 5 * 60 * 1000,
        };
      }

      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
        return token;
      }

      const refreshed = await refreshAccessToken(token);
      if (!refreshed) {
        return { ...token, error: 'RefreshAccessTokenError' };
      }
      return { ...token, ...refreshed };
    },
    async session({ session, token: rawToken }) {
      const token = rawToken as AppJWT;
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});

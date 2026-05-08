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
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  idToken?: string;
  error?: 'RefreshAccessTokenError';
} & Record<string, unknown>;

async function refreshAccessToken(token: { refreshToken?: string }) {
  if (!token.refreshToken) return null;
  const issuer = process.env.AUTH_KEYCLOAK_ISSUER!.replace(/\/+$/, '');
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
    async jwt({ token: rawToken, account, profile }) {
      const token = rawToken as AppJWT;
      if (account && account.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.accessTokenExpires = (account.expires_at ?? 0) * 1000 || Date.now() + 5 * 60 * 1000;
        if (profile && typeof profile === 'object') {
          token.name = (profile as { name?: string }).name ?? token.name;
          token.email = (profile as { email?: string }).email ?? token.email;
          token.picture = (profile as { picture?: string }).picture ?? token.picture;
        }
        return token;
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
      session.user = {
        ...session.user,
        name: token.name ?? session.user?.name,
        email: token.email ?? session.user?.email,
        image: token.picture ?? session.user?.image,
      };
      return session;
    },
  },
});

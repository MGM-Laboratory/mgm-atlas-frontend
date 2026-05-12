// Frontend-only auth utilities - no NextAuth, no cookies
// Sessions are stored in localStorage and sent in Authorization headers

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

export interface Session {
  sessionId: string;
  user: {
    id: string;
    keycloakId: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    isAdmin: boolean;
  };
  expiresAt: Date;
}

const SESSION_STORAGE_KEY = 'atlas_session';
const TOKENS_STORAGE_KEY = 'atlas_tokens';

/**
 * Get the stored session from localStorage
 */
export function getStoredSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as Session;
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Store session in localStorage
 */
export function storeSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Get the stored tokens from localStorage
 */
export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(TOKENS_STORAGE_KEY);
  if (!stored) return null;
  try {
    const tokens = JSON.parse(stored) as AuthTokens;
    // Check if expired
    if (tokens.expiresAt < Date.now()) {
      clearSession();
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Store tokens in localStorage
 */
export function storeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Clear all session and token data
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(TOKENS_STORAGE_KEY);
}

/**
 * Get the session ID for Authorization header
 */
export function getSessionId(): string | null {
  const session = getStoredSession();
  return session?.sessionId ?? null;
}

/**
 * Decode JWT payload without verification (for client-side use)
 */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract user info from ID token
 */
export function extractUserFromIdToken(idToken: string): {
  keycloakId: string;
  email: string;
  name: string;
  picture?: string;
} | null {
  const decoded = decodeJwt(idToken);
  if (!decoded) return null;

  return {
    keycloakId: (decoded.sub as string) ?? '',
    email: (decoded.email as string) ?? '',
    name: (decoded.name as string) ?? '',
    picture: (decoded.picture as string) ?? undefined,
  };
}

/**
 * Build Keycloak authorization URL for OAuth2 flow
 */
export function buildKeycloakAuthUrl(): string {
  const keycloakIssuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!keycloakIssuer) {
    throw new Error('Missing NEXT_PUBLIC_KEYCLOAK_ISSUER environment variable');
  }
  if (!clientId) {
    throw new Error('Missing NEXT_PUBLIC_KEYCLOAK_CLIENT_ID environment variable');
  }
  if (!appUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL environment variable');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid profile email offline_access',
    redirect_uri: redirectUri,
    state: generateState(),
  });

  return `${keycloakIssuer}/protocol/openid-connect/auth?${params.toString()}`;
}

/**
 * Generate and store a random state parameter for OAuth2 CSRF protection
 */
function generateState(): string {
  return crypto.getRandomValues(new Uint8Array(16)).reduce((acc, byte) => {
    return acc + byte.toString(16).padStart(2, '0');
  }, '');
}

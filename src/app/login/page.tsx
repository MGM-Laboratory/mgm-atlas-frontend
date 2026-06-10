import { redirect } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { sanitizeReturnTo } from '@/lib/auth-redirect';
import { Wordmark } from '@/components/brand/wordmark';
import { PatternCorner } from '@/components/brand/pattern-corner';
import { ShapeSignature } from '@/components/brand/shape-signature';
import { LoginClient } from '@/components/auth/login-client';

interface PageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    reason?: string;
    error?: string;
    error_status?: string;
    error_detail?: string;
  }>;
}

const ERROR_HINTS: Record<string, string> = {
  session_creation_failed:
    'The Atlas API rejected the /auth/login request — usually a database problem (missing Session table, broken migration) or the API process is down. Check the API logs.',
  missing_identity_claims:
    'The Keycloak ID token had no sub or email claim. In the Keycloak admin, open the atlas-web client (or the email/profile client scopes) and confirm the email and profile mappers are enabled and added to the ID token.',
  token_exchange_failed:
    'Keycloak refused to exchange the authorization code. Check that the client secret is correct and that the redirect URI matches exactly.',
  missing_parameters:
    'The redirect from Keycloak was missing required parameters. Re-initiate the sign-in.',
  missing_api_url: 'NEXT_PUBLIC_API_URL is not configured for the frontend.',
  invalid_session_data: 'The session blob returned by the callback could not be parsed. Sign in again.',
  internal_error: 'An unexpected error occurred. Check the frontend server logs.',
};

export default async function LoginPage({ searchParams }: PageProps) {
  const session = getStoredSession();
  const params = await searchParams;

  // If already logged in, redirect to the requested page (or dashboard).
  // NOTE: this server-side branch is currently dead — getStoredSession()
  // is window-gated and always returns null on the server — but the
  // callbackUrl is sanitized anyway so it stays safe if a server-side
  // session source ever lands.
  if (session) {
    redirect(sanitizeReturnTo(params.callbackUrl) ?? '/dashboard');
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-white px-6">
      <PatternCorner position="top-right" size={3} cellSize={72} />
      <PatternCorner position="bottom-left" size={2} cellSize={56} />

      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <ShapeSignature size={36} />
          <Wordmark withSignature={false} className="text-[28px]" />
        </div>

        <div className="rounded-xl border border-line bg-white p-8 shadow-1">
          <h1 className="font-display text-display-lg tracking-[-0.02em] text-ink">
            Welcome back
          </h1>
          <p className="mt-2 text-body-sm text-ink-2">
            Sign in to discover, manage, and contribute to MGM Laboratory projects.
          </p>

          {params.reason === 'session-expired' ? (
            <div className="mt-5 rounded border border-brand-yellow bg-brand-yellow-50 px-4 py-3 text-[14px] text-brand-yellow-ink">
              Your session expired. Sign in again to continue.
            </div>
          ) : null}

          {params.error ? (
            <div className="mt-5 rounded border border-brand-red/30 bg-brand-red-50 px-4 py-3 text-[13px] text-ink">
              <div className="font-medium text-brand-red">
                Authentication failed: {params.error}
                {params.error_status ? ` (${params.error_status})` : null}
              </div>
              {ERROR_HINTS[params.error] ? (
                <p className="mt-1 text-ink-2">{ERROR_HINTS[params.error]}</p>
              ) : null}
              {params.error_detail ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-white/60 p-2 font-mono text-[11px] text-ink-3">
                  {params.error_detail}
                </pre>
              ) : null}
            </div>
          ) : null}

          <LoginClient callbackUrl={params.callbackUrl} />

          <p className="mt-6 text-[13px] text-ink-3">
            You will be redirected to{' '}
            <span className="font-medium text-ink-2">iam.labmgm.org</span> for authentication.
          </p>
        </div>

        <p className="mt-6 text-center text-[13px] text-ink-3">
          MGM Laboratory · Internal Service
        </p>
      </div>
    </main>
  );
}

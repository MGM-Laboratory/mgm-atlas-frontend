import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand/wordmark';
import { PatternCorner } from '@/components/brand/pattern-corner';
import { ShapeSignature } from '@/components/brand/shape-signature';

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string; reason?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const session = await auth();
  const params = await searchParams;
  if (session && !session.error) {
    redirect(params.callbackUrl ?? '/dashboard');
  }

  async function login() {
    'use server';
    const params = await searchParams;
    await signIn('keycloak', { redirectTo: params.callbackUrl ?? '/dashboard' });
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

          <form action={login} className="mt-6">
            <Button type="submit" size="lg" className="w-full">
              Continue with Keycloak
            </Button>
          </form>

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

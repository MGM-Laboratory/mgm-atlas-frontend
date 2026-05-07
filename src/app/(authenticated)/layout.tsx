import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { api } from '@/lib/api/server';
import { apiPaths } from '@/lib/api/paths';
import type { SessionUser } from '@/lib/types';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  // Fetch the synced Atlas user (carries isAdmin) so the header can render
  // the admin entry point without an extra client round-trip.
  const me = await api<SessionUser & { lastLoginAt: string | null }>(apiPaths.session()).catch(
    () => null,
  );

  return (
    <div className="flex min-h-svh flex-col">
      <Header user={me} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

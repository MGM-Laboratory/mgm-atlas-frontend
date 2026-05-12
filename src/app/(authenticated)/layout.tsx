'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = getStoredSession();

  useEffect(() => {
    // Redirect to login if no session
    if (!session) {
      router.push('/login');
    }
  }, [session, router]);

  if (!session) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Header user={session.user} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}


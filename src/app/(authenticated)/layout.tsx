'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

// In-conversation chat pages: /projects/<slug>/chat/<channelId>. On these
// routes we hide the footer and lock the outer chrome to the viewport so
// the message list (and only the message list) is what scrolls.
const CHAT_CONVERSATION_RE = /^\/projects\/[^/]+\/chat\/[^/]+/;

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = getStoredSession();

  useEffect(() => {
    if (!session) {
      router.push('/login');
    }
  }, [session, router]);

  if (!session) {
    return null;
  }

  const isChatConversation = pathname ? CHAT_CONVERSATION_RE.test(pathname) : false;

  if (isChatConversation) {
    return (
      <div className="flex h-svh flex-col overflow-hidden">
        <Header user={session.user} />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      <Header user={session.user} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}


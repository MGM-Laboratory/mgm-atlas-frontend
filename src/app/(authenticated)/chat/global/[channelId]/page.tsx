'use client';

import { useParams } from 'next/navigation';
import { getStoredSession } from '@/lib/auth-client';
import { ChatLayout } from '@/components/chat/chat-layout';

/**
 * Workspace-global channel view (e.g. the workspace #general). Every
 * authenticated user can read and write; admins manage. No project
 * query needed — the channel carries no project context.
 */
export default function GlobalChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const session = getStoredSession();

  if (!session) return null;

  return (
    <ChatLayout
      scope={{ kind: 'global' }}
      projectId={null}
      channelId={channelId}
      currentUserId={session.user.id}
      isManager={session.user.isAdmin === true}
    />
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getNotificationsSocket } from '@/lib/realtime/socket';
import { onNotificationClick, registerServiceWorker } from '@/lib/notifications/sw-registration';
import { EnableBanner } from './enable-banner';

interface ServerNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Page-level glue mounted once in the authenticated layout. Owns:
 *   1. Service worker registration (idempotent — registers /sw.js on
 *      every authenticated page load; the SW handles updates itself).
 *   2. Realtime `/notifications` socket. On `notification:new` we both
 *      invalidate the bell's TanStack Query cache (instant badge +
 *      list refresh) and surface a tiny in-app toast/sound when the
 *      tab is visible. On `notification:unread` we just invalidate so
 *      reads from another device push down the badge here too.
 *   3. Bridge for clicks delivered through the SW: when the SW posts
 *      `atlas:notification-click`, we navigate inside the SPA so React
 *      Query cache and any in-flight state survive the focus.
 *   4. First-event soft-prompt banner anchored to the bottom-right.
 */
export function NotificationsClient() {
  const router = useRouter();
  const qc = useQueryClient();

  React.useEffect(() => {
    void registerServiceWorker();
  }, []);

  React.useEffect(() => {
    const socket = getNotificationsSocket();
    if (!socket) return;

    const onNew = (n: ServerNotification) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      // Foreground sound + native banner from the page itself when the
      // tab is visible. (When the tab is hidden, the SW shows the push
      // banner; we don't double up.)
      if (document.visibilityState === 'visible' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(n.title, { body: n.body, icon: '/icon.svg', tag: `notif:${n.id}` });
          } catch {
            // Some browsers (notably Chrome ≥ 49) require Notifications
            // to come from a service worker. That's fine — the SW has
            // already shown the banner; the invalidate above keeps the
            // bell badge accurate.
          }
        }
      }
    };
    const onUnread = () => qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });

    socket.on('notification:new', onNew);
    socket.on('notification:unread', onUnread);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:unread', onUnread);
    };
  }, [qc]);

  React.useEffect(() => {
    const stop = onNotificationClick(({ link }) => {
      // Internal links only — never let the SW navigate to an
      // arbitrary URL. The backend only emits links rooted at `/`.
      if (link.startsWith('/')) router.push(link as never);
    });
    return stop;
  }, [router]);

  return <EnableBanner />;
}

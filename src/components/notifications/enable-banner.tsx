'use client';

import * as React from 'react';
import { Bell, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { usePushPermission } from '@/lib/notifications/use-push-permission';
import { useToast } from '@/components/ui/toast';

/**
 * Soft-prompt banner shown bottom-right when:
 *   1. Browser supports the Notification + PushManager APIs.
 *   2. The user hasn't been asked yet (`Notification.permission === 'default'`).
 *   3. The user hasn't previously dismissed our prompt (localStorage flag).
 *   4. They have at least one notification in their account — so we ask
 *      in context: "you got a notification, want them to reach you?"
 *
 * "Not now" sets the dismissal flag and never re-prompts. Settings page
 * lets users re-enable manually if they change their mind.
 */
export function EnableBanner() {
  const { canPrompt, busy, enable, dismiss } = usePushPermission();
  const { show } = useToast();

  // Anchor the soft-prompt to "the user has notifications" so we never
  // surprise a fresh account.
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api<{ unread: number }>(apiPaths.unreadCount()),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    enabled: canPrompt,
  });

  const visible = canPrompt && (unread.data?.unread ?? 0) > 0;

  if (!visible) return null;

  const onEnable = async () => {
    const result = await enable();
    if (result.ok) {
      show({ title: 'Browser notifications enabled', tone: 'success' });
    } else if (result.reason === 'permission-denied') {
      show({
        title: 'Notifications blocked',
        description: 'You can re-enable them from the browser site settings.',
        tone: 'warning',
      });
    } else if (result.reason === 'not-configured') {
      // Backend not yet wired with VAPID — silently hide the banner; the
      // user can't do anything about this.
      dismiss();
    } else if (result.reason === 'unsupported') {
      dismiss();
    } else {
      show({
        title: 'Couldn’t enable notifications',
        description: result.message,
        tone: 'danger',
      });
    }
  };

  return (
    <div
      role="region"
      aria-label="Enable browser notifications"
      className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-line bg-surface p-4 shadow-2"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-grid h-7 w-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2.25} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-blue-50 text-brand-blue">
          <Bell className="h-4.5 w-4.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ink">Get notified when you&apos;re mentioned</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
            We&apos;ll send a browser notification for chat mentions, task comments, and
            assignments — even when this tab is closed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onEnable}
              className="inline-flex items-center justify-center rounded bg-brand-blue px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Enabling…' : 'Enable'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={dismiss}
              className="inline-flex items-center justify-center rounded px-3 py-1.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-surface-muted"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

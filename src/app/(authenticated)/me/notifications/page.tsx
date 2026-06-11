'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import type {
  NotificationPreference,
  NotificationPreferenceKey,
  PushSubscriptionDevice,
} from '@/lib/types';
import { Container } from '@/components/layout/container';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { usePushPermission } from '@/lib/notifications/use-push-permission';
import { clearEnablePromptDismissed } from '@/lib/notifications/permission';
import { unsubscribePush } from '@/lib/notifications/push-subscription';
import { formatRelative } from '@/lib/utils';

/**
 * Grouping is intentionally coarse — each card collapses a related
 * cluster of NotificationTypes onto a single label so the UI doesn't
 * become a wall of 14 toggles. The bool keys map 1:1 to the backend's
 * NotificationPreference columns.
 */
interface ToggleSection {
  title: string;
  description: string;
  toggles: { key: NotificationPreferenceKey; label: string; hint?: string }[];
}

const SECTIONS: ToggleSection[] = [
  {
    title: 'Chat',
    description: 'Direct mentions in project channels.',
    toggles: [
      { key: 'chatMentionEnabled', label: 'Channel @mentions', hint: 'Someone @mentions you in a project chat.' },
    ],
  },
  {
    title: 'Tasks',
    description: 'PMO task activity that involves you.',
    toggles: [
      { key: 'taskAssignedEnabled', label: 'Assigned to a task' },
      { key: 'taskMentionedEnabled', label: 'Mentioned in a task comment' },
      { key: 'taskCommentReplyEnabled', label: 'Reply to your task comment' },
      { key: 'taskDueSoonEnabled', label: 'Task due soon' },
      { key: 'taskOverdueEnabled', label: 'Task overdue' },
      { key: 'taskStatusChangedEnabled', label: 'Task status changed' },
      { key: 'taskDependencyBlockedEnabled', label: 'Task blocked by a dependency' },
    ],
  },
  {
    title: 'Notes & whiteboards',
    description: 'PMO note + whiteboard mentions.',
    toggles: [
      { key: 'noteMentionedEnabled', label: 'Mentioned in a note' },
      { key: 'whiteboardMentionedEnabled', label: 'Mentioned in a whiteboard' },
    ],
  },
  {
    title: 'Projects',
    description: 'Invitations, role changes, contribution requests.',
    toggles: [
      { key: 'projectInvitedEnabled', label: 'Invited to a project' },
      { key: 'projectRoleChangedEnabled', label: 'Role on a project changed' },
      { key: 'projectRemovedEnabled', label: 'Removed from a project' },
      { key: 'contributionRequestEnabled', label: 'Contribution request updates' },
    ],
  },
  {
    title: 'Voice',
    description: 'Voice channel activity.',
    toggles: [
      { key: 'voiceParticipantJoinedEnabled', label: 'Someone joined your voice channel' },
      { key: 'voiceMentionedEnabled', label: 'Mentioned in voice chat' },
    ],
  },
];

export default function NotificationSettingsPage() {
  const qc = useQueryClient();
  const { show } = useToast();
  const { permission, refresh, enable, busy: enabling } = usePushPermission();

  const prefsQuery = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => api<NotificationPreference>(apiPaths.notificationPreferences()),
  });

  const devicesQuery = useQuery({
    queryKey: ['notifications', 'devices'],
    queryFn: () => api<PushSubscriptionDevice[]>(apiPaths.pushSubscriptions()),
  });

  const patchPrefs = useMutation({
    mutationFn: (patch: Partial<Record<NotificationPreferenceKey, boolean>>) =>
      api<NotificationPreference>(apiPaths.notificationPreferences(), {
        method: 'PATCH',
        body: patch,
      }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['notifications', 'preferences'] });
      const prev = qc.getQueryData<NotificationPreference>(['notifications', 'preferences']);
      if (prev) {
        qc.setQueryData<NotificationPreference>(
          ['notifications', 'preferences'],
          { ...prev, ...patch },
        );
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', 'preferences'], ctx.prev);
      show({ title: 'Couldn’t save preference', tone: 'danger' });
    },
    onSuccess: (data) => {
      qc.setQueryData(['notifications', 'preferences'], data);
    },
  });

  const removeDevice = useMutation({
    mutationFn: (id: string) => unsubscribePush(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'devices'] });
      show({ title: 'Device removed', tone: 'success' });
    },
  });

  const reenableBanner = () => {
    clearEnablePromptDismissed();
    refresh();
    show({ title: 'Banner restored', description: 'It’ll re-appear when you have a notification.', tone: 'info' });
  };

  const onEnableClicked = async () => {
    const result = await enable();
    if (result.ok) {
      qc.invalidateQueries({ queryKey: ['notifications', 'devices'] });
      show({ title: 'Browser notifications enabled', tone: 'success' });
    } else if (result.reason === 'permission-denied') {
      show({
        title: 'Notifications blocked',
        description: 'Re-enable them from your browser site settings.',
        tone: 'warning',
      });
    } else if (result.reason === 'not-configured') {
      show({
        title: 'Push not configured',
        description: 'The server isn’t set up to send pushes yet.',
        tone: 'warning',
      });
    } else if (result.reason === 'unsupported') {
      show({
        title: 'Browser doesn’t support push',
        description: 'On iOS, install Atlas to your home screen first.',
        tone: 'info',
      });
    }
  };

  const prefs = prefsQuery.data;
  const devices = devicesQuery.data ?? [];

  return (
    <Container size="2xl" className="space-y-8 py-10">
      <header>
        <h1 className="font-display text-display-md tracking-[-0.02em] text-ink">
          Notification settings
        </h1>
        <p className="mt-2 text-body-sm text-ink-2">
          Control which events reach you and on which devices.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-blue-50 text-brand-blue">
            <Bell className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-medium text-ink">Browser notifications</h2>
              <PermissionPill state={permission} />
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              {permission === 'granted'
                ? 'Atlas can send notifications to this browser. New events reach you even when this tab is closed.'
                : permission === 'denied'
                ? 'You blocked notifications in your browser. Re-enable them in your browser’s site settings to start receiving pushes again.'
                : permission === 'unsupported'
                ? 'This browser doesn’t support web push. On iOS, install Atlas to your home screen first.'
                : 'Atlas will only show in-app notifications until you enable browser push.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {permission === 'default' || permission === 'denied' ? (
                <Button onClick={onEnableClicked} disabled={enabling || permission === 'denied'}>
                  {enabling ? 'Enabling…' : 'Enable browser notifications'}
                </Button>
              ) : null}
              <Button variant="ghost" onClick={reenableBanner}>
                Restore the soft-prompt banner
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-ink">Master push toggle</h2>
            <p className="mt-1 text-[13px] text-ink-2">
              When off, in-app notifications keep working but Atlas won’t send any browser
              notifications regardless of the per-type toggles below.
            </p>
          </div>
          <Switch
            checked={!!prefs?.pushEnabled}
            disabled={!prefs || patchPrefs.isPending}
            onCheckedChange={(v) => patchPrefs.mutate({ pushEnabled: v })}
          />
        </div>
      </Card>

      <div className="space-y-5">
        {SECTIONS.map((section) => (
          <Card key={section.title} className="p-5">
            <h2 className="text-[15px] font-medium text-ink">{section.title}</h2>
            <p className="mt-1 text-[13px] text-ink-2">{section.description}</p>
            <ul className="mt-4 divide-y divide-line">
              {section.toggles.map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink">{t.label}</p>
                    {t.hint ? (
                      <p className="mt-0.5 text-[12px] text-ink-3">{t.hint}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={!!prefs && prefs[t.key]}
                    disabled={!prefs || patchPrefs.isPending}
                    onCheckedChange={(v) => patchPrefs.mutate({ [t.key]: v })}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="text-[15px] font-medium text-ink">Devices</h2>
        <p className="mt-1 text-[13px] text-ink-2">
          Browsers + devices where you’ve enabled push. Remove one to stop sending pushes to it
          without affecting the others.
        </p>
        {devicesQuery.isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
            <span className="text-[13px]">Loading…</span>
          </div>
        ) : devices.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-3">No devices subscribed yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] text-ink">
                    {describeUserAgent(d.userAgent)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    Last seen {formatRelative(d.lastSeenAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => removeDevice.mutate(d.id)}
                  disabled={removeDevice.isPending}
                  aria-label="Remove device"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}

function PermissionPill({ state }: { state: 'default' | 'granted' | 'denied' | 'unsupported' }) {
  const cfg: Record<typeof state, { label: string; cls: string }> = {
    granted: { label: 'Allowed', cls: 'bg-brand-green-50 text-brand-green' },
    denied: { label: 'Blocked', cls: 'bg-brand-red-50 text-brand-red' },
    default: { label: 'Not asked', cls: 'bg-surface-muted text-ink-2' },
    unsupported: { label: 'Unsupported', cls: 'bg-surface-muted text-ink-3' },
  };
  const { label, cls } = cfg[state];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

/**
 * Very light UA parsing — just enough to give the device row a
 * recognisable label. Nothing parses every UA perfectly; we pick a
 * short hint and lean on `lastSeenAt` to disambiguate duplicates.
 */
function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}

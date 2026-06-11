'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  VoiceAudioQuality,
  VoiceChannelKind,
  VoiceChannelPublic,
} from '@/lib/voice/types';

/**
 * Shared create/edit dialog for voice channels. The same form fields
 * are used for both flows; the parent controls open/close state and
 * passes either projectSlugOrId (per-project) or undefined (lobby).
 *
 * On submit, calls POST or PATCH against the appropriate endpoint and
 * invalidates the relevant TanStack Query. The realtime gateway also
 * fires voice.channel.created/updated, but invalidating is the
 * authoritative cache update — the socket events are a UI hint for
 * OTHER tabs / other users.
 */
interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Per-project slug — if omitted, the dialog uses the lobby endpoints. */
  projectSlugOrId?: string;
}

interface CreateProps extends BaseProps {
  mode: 'create';
}

interface EditProps extends BaseProps {
  mode: 'edit';
  channel: VoiceChannelPublic;
}

type Props = CreateProps | EditProps;

export function VoiceChannelDialog(props: Props) {
  const { open, onOpenChange, projectSlugOrId } = props;
  const isEdit = props.mode === 'edit';
  const channel = isEdit ? props.channel : null;

  const [name, setName] = React.useState('');
  const [topic, setTopic] = React.useState('');
  const [userLimit, setUserLimit] = React.useState('');
  const [audioQuality, setAudioQuality] = React.useState<VoiceAudioQuality>('STANDARD');
  const [kind, setKind] = React.useState<VoiceChannelKind>('STANDARD');

  // Reset the form whenever the dialog opens with a different target.
  React.useEffect(() => {
    if (!open) return;
    setName(channel?.name ?? '');
    setTopic(channel?.topic ?? '');
    setUserLimit(channel?.userLimit ? String(channel.userLimit) : '');
    setAudioQuality(channel?.audioQuality ?? 'STANDARD');
    setKind(channel?.kind ?? 'STANDARD');
  }, [open, channel]);

  const queryClient = useQueryClient();

  const createUrl = projectSlugOrId
    ? apiPaths.voice.channels(projectSlugOrId)
    : apiPaths.voice.lobbyChannels();
  const editUrl =
    channel && projectSlugOrId
      ? apiPaths.voice.channel(projectSlugOrId, channel.id)
      : channel
        ? apiPaths.voice.lobbyChannel(channel.id)
        : '';

  const invalidate = () => {
    if (projectSlugOrId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.voice.channels(projectSlugOrId),
      });
    } else {
      void queryClient.invalidateQueries({ queryKey: queryKeys.voice.lobby });
    }
  };

  const mutation = useMutation({
    mutationFn: async (body: {
      name: string;
      topic?: string;
      userLimit?: number;
      audioQuality?: VoiceAudioQuality;
      kind?: VoiceChannelKind;
    }) => {
      if (isEdit) {
        return api<VoiceChannelPublic>(editUrl, { method: 'PATCH', body });
      }
      return api<VoiceChannelPublic>(createUrl, { method: 'POST', body });
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
  });

  const errorMessage = mutation.isError
    ? (mutation.error as { body?: { message?: string } })?.body?.message ??
      `Failed to ${isEdit ? 'update' : 'create'} channel.`
    : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const limit = userLimit.trim() ? Number.parseInt(userLimit, 10) : undefined;
    mutation.mutate({
      name: trimmedName,
      topic: topic.trim() || undefined,
      userLimit:
        limit !== undefined && !Number.isNaN(limit) && limit >= 0 ? limit : undefined,
      audioQuality,
      // Only send kind on create. Backend doesn't support kind change
      // on edit (would require reseating every active participant).
      ...(isEdit ? {} : { kind }),
    });
  };

  // The default channel can't be renamed (backend enforces it).
  const nameDisabled = isEdit && channel?.isDefault;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogTitle>{isEdit ? 'Channel settings' : 'New voice channel'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Adjust how this voice channel behaves.'
            : 'Add a new voice channel for this project.'}
        </DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="vc-name">Name</Label>
            <Input
              id="vc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Design Sync"
              autoFocus={!isEdit}
              disabled={!!nameDisabled}
            />
            {nameDisabled ? (
              <p className="text-[11px] text-ink-3">
                The default voice channel can&apos;t be renamed.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc-topic">Topic (optional)</Label>
            <Input
              id="vc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What this channel is for"
              maxLength={200}
            />
          </div>
          {!isEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="vc-kind">Channel type</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as VoiceChannelKind)}
              >
                <SelectTrigger id="vc-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard — everyone speaks</SelectItem>
                  <SelectItem value="STAGE">
                    Stage — speakers + audience (mods promote raised hands)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-ink-3">
                Channel type can&apos;t be changed later. Stage channels are great
                for presentations or all-hands.
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vc-limit">User limit</Label>
              <Input
                id="vc-limit"
                type="number"
                min={0}
                max={100}
                value={userLimit}
                onChange={(e) => setUserLimit(e.target.value)}
                placeholder="No limit"
              />
              <p className="text-[11px] text-ink-3">0 or empty = unlimited</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vc-quality">Audio quality</Label>
              <Select
                value={audioQuality}
                onValueChange={(v) => setAudioQuality(v as VoiceAudioQuality)}
              >
                <SelectTrigger id="vc-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low (32 kbps)</SelectItem>
                  <SelectItem value="STANDARD">Standard (64 kbps)</SelectItem>
                  <SelectItem value="HIGH">High (128 kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {errorMessage ? (
            <div className="text-[13px] text-brand-red">{errorMessage}</div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={!name.trim()}>
              {isEdit ? 'Save changes' : 'Create channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

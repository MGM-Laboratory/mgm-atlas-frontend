'use client';

import * as React from 'react';
import { MoreVertical, Plus, Settings, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { VoiceChannelPublic } from '@/lib/voice/types';
import { VoiceChannelDialog } from './voice-channel-dialog';

/**
 * "+" button next to the Voice section header. Opens the
 * VoiceChannelDialog in create mode. Per-project version takes a
 * projectSlugOrId; lobby version omits it (admin-only flow).
 */
export function CreateVoiceChannelButton({
  projectSlugOrId,
  label = 'New voice channel',
}: {
  projectSlugOrId?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        className="inline-grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-white hover:text-ink"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <VoiceChannelDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        projectSlugOrId={projectSlugOrId}
      />
    </>
  );
}

/**
 * Three-dot menu on a voice channel row. Items:
 *   - Channel settings → opens VoiceChannelDialog in edit mode
 *   - Delete channel   → confirmation dialog → archive (soft delete)
 *
 * The default voice channel ("General Voice") cannot be archived;
 * the backend returns 403 and we render the menu item disabled.
 */
export function VoiceChannelSettingsMenu({
  channel,
  projectSlugOrId,
}: {
  channel: VoiceChannelPublic;
  projectSlugOrId?: string;
}) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const deleteUrl = projectSlugOrId
    ? apiPaths.voice.channel(projectSlugOrId, channel.id)
    : apiPaths.voice.lobbyChannel(channel.id);

  const archiveMutation = useMutation({
    mutationFn: () => api(deleteUrl, { method: 'DELETE' }),
    onSuccess: () => {
      if (projectSlugOrId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.voice.channels(projectSlugOrId),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.voice.lobby });
      }
      setDeleteOpen(false);
    },
  });

  const deleteErrorMessage = archiveMutation.isError
    ? (archiveMutation.error as { body?: { message?: string } })?.body?.message ??
      'Failed to delete channel.'
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Channel options"
            onClick={(e) => {
              // Don't navigate to the channel when clicking the menu.
              e.preventDefault();
              e.stopPropagation();
            }}
            className="inline-grid h-6 w-6 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-white hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setEditOpen(true)}
            className="gap-2 text-[13px]"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={2.25} />
            Channel settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={channel.isDefault}
            onSelect={() => {
              if (channel.isDefault) return;
              setDeleteOpen(true);
            }}
            className="gap-2 text-[13px] text-brand-red focus:text-brand-red"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            {channel.isDefault ? 'Delete (default channel)' : 'Delete channel'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VoiceChannelDialog
        mode="edit"
        channel={channel}
        open={editOpen}
        onOpenChange={setEditOpen}
        projectSlugOrId={projectSlugOrId}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogTitle>Delete voice channel?</DialogTitle>
          <DialogDescription>
            <strong className="text-ink-1">{channel.name}</strong> will be archived.
            Anyone currently in the channel will be disconnected. This can be
            undone by an admin if needed.
          </DialogDescription>
          {deleteErrorMessage ? (
            <div className="mt-2 text-[13px] text-brand-red">{deleteErrorMessage}</div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

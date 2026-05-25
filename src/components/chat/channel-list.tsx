'use client';

import * as React from 'react';
import Link from 'next/link';
import { Hash, Lock, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ChatChannel } from '@/lib/types';

interface Props {
  projectSlug: string;
  projectTitle: string;
  activeChannelId: string;
  canManage: boolean;
}

export function ChannelList({ projectSlug, projectTitle, activeChannelId, canManage }: Props) {
  const channelsQuery = useQuery({
    queryKey: queryKeys.chat.channels(projectSlug),
    queryFn: () => api<ChatChannel[]>(apiPaths.chat.channels(projectSlug)),
    refetchOnWindowFocus: false,
  });

  const channels = channelsQuery.data ?? [];
  const active = channels.filter((c) => !c.isArchived);
  const archived = channels.filter((c) => c.isArchived);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface-muted/40">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Project
        </div>
        <div className="mt-0.5 truncate text-[14px] font-semibold text-ink">{projectTitle}</div>
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          Channels
        </span>
        {canManage ? <CreateChannelButton projectSlug={projectSlug} /> : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        <ul className="space-y-0.5">
          {active.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              projectSlug={projectSlug}
              active={c.id === activeChannelId}
            />
          ))}
        </ul>

        {archived.length > 0 ? (
          <>
            <div className="mt-4 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
              Archived
            </div>
            <ul className="mt-1 space-y-0.5">
              {archived.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  projectSlug={projectSlug}
                  active={c.id === activeChannelId}
                />
              ))}
            </ul>
          </>
        ) : null}
      </nav>
    </aside>
  );
}

function ChannelRow({
  channel,
  projectSlug,
  active,
}: {
  channel: ChatChannel;
  projectSlug: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={`/projects/${projectSlug}/chat/${channel.id}` as never}
        className={cn(
          'flex items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors',
          active ? 'bg-white text-ink shadow-1' : 'text-ink-2 hover:bg-white/70 hover:text-ink',
          channel.isArchived && 'opacity-60',
        )}
      >
        {channel.isArchived ? (
          <Lock className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
        ) : (
          <Hash className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
        )}
        <span className="truncate">{channel.name}</span>
      </Link>
    </li>
  );
}

function CreateChannelButton({ projectSlug }: { projectSlug: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [topic, setTopic] = React.useState('');

  const createMutation = useMutation({
    mutationFn: (body: { name: string; topic?: string }) =>
      api<ChatChannel>(apiPaths.chat.channels(projectSlug), { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.channels(projectSlug) });
      setOpen(false);
      setName('');
      setTopic('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="New channel"
          className="inline-grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-white hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </DialogTrigger>
      <DialogContent size="sm">
        <h2 className="font-display text-h3 text-ink">New channel</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          Letters, numbers, hyphens and underscores. Lowercase recommended.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim().toLowerCase();
            if (!trimmed) return;
            createMutation.mutate({ name: trimmed, topic: topic.trim() || undefined });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="design-review"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-topic">Topic (optional)</Label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What this channel is for"
            />
          </div>
          {createMutation.isError ? (
            <div className="text-[13px] text-brand-red">
              {(createMutation.error as { body?: { message?: string } })?.body?.message ??
                'Failed to create channel.'}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

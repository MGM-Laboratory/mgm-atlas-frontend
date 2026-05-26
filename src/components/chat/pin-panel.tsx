'use client';

import * as React from 'react';
import { Pin, PinOff, X, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { ChatAttachment, ChatAttachmentKind, ChatMessageKind } from '@/lib/types';
import { MarkdownBody } from './markdown-body';

interface PinnedRow {
  id: string;
  channelId: string;
  position: number;
  pinnedAt: string;
  pinnedBy: { id: string; name: string; avatarUrl: string | null };
  message: {
    id: string;
    channelId: string;
    kind: ChatMessageKind;
    markdown: string;
    deletedAt: string | null;
    createdAt: string;
    author: { id: string; name: string; avatarUrl: string | null };
    attachments: ChatAttachment[];
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectSlug: string;
  channelId: string;
  /** Manager-only; if false the Unpin action is hidden. */
  canModerate: boolean;
}

/**
 * Right-side drawer listing pinned messages for the active channel.
 * Click a pin to jump the message list to that message (uses the
 * existing `?msg=` query param the timeline already handles for
 * search hits).
 */
export function PinPanel({ open, onClose, projectSlug, channelId, canModerate }: Props) {
  const queryClient = useQueryClient();
  const pinsQuery = useQuery({
    queryKey: queryKeys.chat.pins(channelId),
    queryFn: () => api<PinnedRow[]>(apiPaths.chat.pins(projectSlug, channelId)),
    enabled: open,
    staleTime: 30_000,
  });

  const unpinMutation = useMutation({
    mutationFn: (messageId: string) =>
      api(apiPaths.chat.unpinMessage(messageId), { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.pins(channelId) });
    },
  });

  if (!open) return null;
  const pins = pinsQuery.data ?? [];

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Pin className="h-4 w-4 text-ink-3" strokeWidth={2.25} />
        <h2 className="flex-1 text-[14px] font-semibold text-ink">Pinned messages</h2>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close pinned messages">
          <X className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {pinsQuery.isLoading ? (
          <div className="grid h-32 place-items-center text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : pins.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-ink-3">
            Nothing pinned yet. Managers can pin a message from its hover menu.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {pins.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <a
                  href={`/projects/${projectSlug}/chat/${channelId}?msg=${p.message.id}`}
                  className="block rounded -mx-2 px-2 py-1 hover:bg-surface-muted/60"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={p.message.author.avatarUrl}
                      name={p.message.author.name}
                      size={24}
                    />
                    <div className="flex-1 truncate text-[12px]">
                      <span className="font-medium text-ink">{p.message.author.name}</span>{' '}
                      <span className="text-ink-3">
                        · {new Date(p.message.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  {p.message.deletedAt ? (
                    <div className="mt-1 text-[12px] italic text-ink-3">Message deleted</div>
                  ) : (
                    <>
                      {p.message.markdown ? (
                        <div className="mt-1 line-clamp-4 text-[13px] text-ink">
                          <MarkdownBody markdown={p.message.markdown} />
                        </div>
                      ) : null}
                      {p.message.attachments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.message.attachments.slice(0, 2).map((a) => (
                            <CompactAttachment key={a.id} attachment={a} />
                          ))}
                          {p.message.attachments.length > 2 ? (
                            <span className="grid place-items-center rounded border border-line px-2 text-[11px] text-ink-3">
                              +{p.message.attachments.length - 2}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </a>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
                  <span>
                    Pinned by {p.pinnedBy.name}{' '}
                    {new Date(p.pinnedAt).toLocaleDateString()}
                  </span>
                  {canModerate ? (
                    <button
                      type="button"
                      onClick={() => unpinMutation.mutate(p.message.id)}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ink-3 hover:bg-surface-muted hover:text-ink"
                      disabled={unpinMutation.isPending}
                    >
                      <PinOff className="h-3 w-3" strokeWidth={2.25} />
                      Unpin
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function CompactAttachment({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === ('IMAGE' satisfies ChatAttachmentKind)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={attachment.url}
        alt=""
        className="h-12 w-12 rounded border border-line object-cover"
      />
    );
  }
  return (
    <div className="max-w-[160px] truncate rounded border border-line bg-white px-2 py-1 text-[11px] text-ink-2">
      {attachment.s3Key.split('/').pop() ?? 'file'}
    </div>
  );
}


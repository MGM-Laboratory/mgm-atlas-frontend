'use client';

import * as React from 'react';
import { Reply, Trash2, Pencil, Check, X, Forward, Pin } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { AttachmentRenderer } from './attachment-renderer';
import { ForwardDialog } from './forward-dialog';
import { LinkPreviewCard } from './link-preview-card';
import { MarkdownBody } from './markdown-body';
import { PinButton } from './pin-button';
import { ReactionPicker } from './reaction-picker';

interface Props {
  message: ChatMessage;
  /** When true, hide the author header — same author posting in quick succession. */
  grouped: boolean;
  currentUserId: string;
  isManager: boolean;
  onReply: (message: ChatMessage) => void;
}

export function MessageItem({ message, grouped, currentUserId, isManager, onReply }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.markdown);
  const [forwardOpen, setForwardOpen] = React.useState(false);
  // Anchored popovers inside the hover action bar must keep the bar in DOM
  // while they're open — otherwise the trigger gets display:none on mouse-
  // leave and Radix re-anchors the popover to a zero-size box (visible
  // bug: pin/emoji popover jumps left and flickers).
  const [reactionOpen, setReactionOpen] = React.useState(false);
  const [pinOpen, setPinOpen] = React.useState(false);
  const menuOpen = reactionOpen || pinOpen;

  const isAuthor = message.author.id === currentUserId;
  const canMod = isAuthor || isManager;
  const isDeleted = !!message.deletedAt;
  const isPinned = !!message.isPinned;
  const pinNote = message.pinNote ?? null;

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(message.channelId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.chat.pins(message.channelId) });
  }, [queryClient, message.channelId]);

  const editMutation = useMutation({
    mutationFn: (markdown: string) =>
      api(apiPaths.chat.editMessage(message.id), { method: 'PATCH', body: { markdown } }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(apiPaths.chat.deleteMessage(message.id), { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const reactMutation = useMutation({
    mutationFn: (emoji: string) =>
      api(apiPaths.chat.addReaction(message.id), { method: 'POST', body: { emoji } }),
    onSuccess: invalidate,
  });

  const unreactMutation = useMutation({
    mutationFn: (emoji: string) =>
      api(apiPaths.chat.removeReaction(message.id, emoji), { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  // Edit window — UI-side hint that mirrors the server's 24h rule. The
  // server is the source of truth; this just hides the button.
  const ageHrs = (Date.now() - new Date(message.createdAt).getTime()) / 3_600_000;
  const canEdit = isAuthor && !isDeleted && ageHrs < 24;

  return (
    <li
      className={cn(
        'group relative -mx-2 rounded px-2 py-1 transition-colors',
        // Subtle blue left rail + tinted background differentiate pinned
        // messages from the surrounding stream without shouting.
        isPinned && !isDeleted
          ? 'border-l-2 border-brand-blue bg-brand-blue/[0.03] hover:bg-brand-blue/[0.06]'
          : 'hover:bg-surface-muted/60',
      )}
    >
      {isPinned && !isDeleted ? (
        <div className="mb-1 flex items-start gap-1.5 pl-12 pr-2 text-[11px] text-brand-blue">
          <Pin className="mt-0.5 h-3 w-3 shrink-0 fill-current" strokeWidth={2.25} />
          <span className="font-medium">Pinned</span>
          {pinNote ? (
            <span className="truncate font-normal text-ink-2" title={pinNote}>
              · {pinNote}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <div className="w-9 shrink-0 pt-0.5">
          {grouped ? null : <Avatar src={message.author.avatarUrl} name={message.author.name} size={32} />}
        </div>
        <div className="min-w-0 flex-1">
          {grouped ? null : (
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="text-[14px] font-medium text-ink">{message.author.name}</span>
              <span className="text-[11px] text-ink-3">
                {new Date(message.createdAt).toLocaleString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {message.editedAt && !isDeleted ? (
                <span className="text-[11px] text-ink-3">(edited)</span>
              ) : null}
            </div>
          )}

          {message.replyTo && !isDeleted ? (
            <div className="mb-1 flex items-start gap-2 rounded border-l-2 border-brand-blue/50 bg-surface-muted/60 px-2 py-1 text-[12px]">
              <Reply className="mt-0.5 h-3 w-3 text-ink-3" strokeWidth={2.25} />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-ink-2">{message.replyTo.author.name}</span>{' '}
                <span className="text-ink-3">
                  {message.replyTo.isDeleted ? 'message deleted' : message.replyTo.preview}
                </span>
              </div>
            </div>
          ) : null}

          {message.forwardedFrom && !isDeleted ? (
            <div className="mb-1 inline-flex items-center gap-1 text-[11px] text-ink-3">
              <Forward className="h-3 w-3" strokeWidth={2.25} />
              Forwarded from {message.forwardedFrom.author.name}
            </div>
          ) : null}

          {isDeleted ? (
            <div className="italic text-[13px] text-ink-3">
              {message.deletedActor === 'MODERATOR' && message.deletedBy
                ? `Deleted by ${message.deletedBy.name}`
                : 'Message deleted'}
            </div>
          ) : editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full resize-y rounded border border-line bg-white p-2 text-[14px] focus:border-brand-blue focus:outline-none"
                rows={Math.min(8, Math.max(2, draft.split('\n').length))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => editMutation.mutate(draft)} loading={editMutation.isPending}>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.25} /> Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.markdown);
                  }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <MarkdownBody markdown={message.markdown} />
          )}

          {!isDeleted && message.metadata?.linkPreviews?.length ? (
            <div className="mt-2 max-w-[480px] space-y-1.5">
              {message.metadata.linkPreviews.map((p) => (
                <LinkPreviewCard key={p.url} preview={p} />
              ))}
            </div>
          ) : null}

          {!isDeleted && message.attachments.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((a) => (
                <AttachmentRenderer key={a.id} attachment={a} />
              ))}
            </div>
          ) : null}

          {!isDeleted && message.reactions.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {message.reactions.map((r) => {
                const mine = r.users.some((u) => u.id === currentUserId);
                return (
                  <button
                    key={r.emoji}
                    onClick={() =>
                      mine ? unreactMutation.mutate(r.emoji) : reactMutation.mutate(r.emoji)
                    }
                    title={r.users.map((u) => u.name).join(', ')}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] transition-colors',
                      mine
                        ? 'border-brand-blue/50 bg-brand-blue/10 text-ink'
                        : 'border-line bg-white text-ink-2 hover:border-line-strong',
                    )}
                  >
                    <span>{r.emoji}</span>
                    <span>{r.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Hover action bar.  While an anchored popover (pin / emoji) is open
          we force the bar to `flex` so the popover trigger keeps its
          bounding box — otherwise moving the cursor off the message row
          hides the trigger and Radix re-anchors the popover, which is
          what was causing the flicker / jump. */}
      {!isDeleted && !editing ? (
        <div
          className={cn(
            'absolute right-2 top-0 gap-0.5 rounded border border-line bg-white p-0.5 shadow-1',
            menuOpen ? 'flex' : 'hidden group-hover:flex',
          )}
        >
          <ReactionPicker
            onPick={(e) => reactMutation.mutate(e)}
            onOpenChange={setReactionOpen}
          />
          <IconAction title="Reply" onClick={() => onReply(message)}>
            <Reply className="h-3.5 w-3.5" strokeWidth={2.25} />
          </IconAction>
          <IconAction title="Forward" onClick={() => setForwardOpen(true)}>
            <Forward className="h-3.5 w-3.5" strokeWidth={2.25} />
          </IconAction>
          {canEdit ? (
            <IconAction title="Edit" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} />
            </IconAction>
          ) : null}
          {isManager ? (
            <PinButton
              messageId={message.id}
              isPinned={isPinned}
              onChanged={invalidate}
              onOpenChange={setPinOpen}
            />
          ) : null}
          {canMod ? (
            <IconAction
              title="Delete"
              onClick={() => {
                if (confirm('Delete this message?')) deleteMutation.mutate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-brand-red" strokeWidth={2.25} />
            </IconAction>
          ) : null}
        </div>
      ) : null}

      <ForwardDialog
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        message={message}
      />
    </li>
  );
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-surface-muted hover:text-ink"
    >
      {children}
    </button>
  );
}

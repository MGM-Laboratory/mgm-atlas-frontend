'use client';

import * as React from 'react';
import { Send, X, Reply as ReplyIcon } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/types';

interface Props {
  projectSlug: string;
  channelId: string;
  channelName: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
}

/**
 * P1 composer: plain textarea over GFM markdown source. P3 swaps this
 * for a Tiptap editor with mention autocomplete + markdown
 * serialization — same API surface (POSTs `{ markdown, replyToId,
 * attachments? }`) so nothing downstream changes.
 *
 * Enter sends; Shift+Enter inserts a newline.
 */
export function MessageComposer({ projectSlug, channelId, channelName, replyTo, onClearReply }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Refocus when a reply target is selected.
  React.useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const sendMutation = useMutation({
    mutationFn: (markdown: string) =>
      api(apiPaths.chat.messages(projectSlug, channelId), {
        method: 'POST',
        body: {
          markdown,
          replyToId: replyTo?.id,
          clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      }),
    onSuccess: () => {
      setDraft('');
      onClearReply();
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(channelId) });
    },
  });

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-line bg-white px-6 py-3">
      {replyTo ? (
        <div className="mb-2 flex items-start gap-2 rounded border-l-2 border-brand-blue bg-surface-muted px-3 py-2 text-[12px]">
          <ReplyIcon className="mt-0.5 h-3.5 w-3.5 text-ink-3" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-ink-2">Replying to {replyTo.author.name}</div>
            <div className="truncate text-ink-3">{replyTo.markdown || '(no text)'}</div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            aria-label="Cancel reply"
            className="rounded p-0.5 text-ink-3 hover:bg-line/40 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-lg border border-line bg-white p-2 focus-within:border-line-strong">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(6, Math.max(1, draft.split('\n').length))}
          placeholder={`Message #${channelName}`}
          className="block flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-ink-3"
        />
        <Button
          size="icon-sm"
          onClick={submit}
          disabled={!draft.trim() || sendMutation.isPending}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
        </Button>
      </div>
      {sendMutation.isError ? (
        <div className="mt-1 text-[12px] text-brand-red">
          Failed to send. Press Enter to try again.
        </div>
      ) : null}
    </div>
  );
}

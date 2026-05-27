'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CornerDownLeft, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  MentionSuggest,
  type MentionSuggestHandle,
} from '@/components/chat/mention-suggest';
import type { TaskComment } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Comment composer for the task popup. Reuses the chat module's
 * `MentionSuggest` popover — both surfaces store mentions as
 * `@[Name](userId)` markdown, so the same UI works without a fork.
 *
 * `replyTo` switches the placeholder + adds a small "Replying to X"
 * banner, but the network payload is the same (`replyToId` set).
 */
export function CommentComposer({
  projectSlug,
  taskId,
  replyTo,
  onCancelReply,
  autoFocus,
}: {
  projectSlug: string;
  taskId: string;
  replyTo?: TaskComment | null;
  onCancelReply?: () => void;
  autoFocus?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [value, setValue] = React.useState('');
  const [caret, setCaret] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const mentionRef = React.useRef<MentionSuggestHandle>(null);

  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, replyTo?.id]);

  const send = useMutation({
    mutationFn: async () =>
      api<TaskComment>(apiPaths.pmo.comments.create(projectSlug, taskId), {
        method: 'POST',
        body: {
          markdown: value.trim(),
          replyToId: replyTo?.id,
        },
      }),
    onSuccess: () => {
      setValue('');
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.comments(projectSlug, taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pmo.activity(projectSlug, taskId) });
      if (replyTo && onCancelReply) onCancelReply();
    },
    onError: (err: unknown) => {
      toast.show({
        title: 'Could not post comment',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        tone: 'danger',
      });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let the mention popover swallow arrow keys / Enter when open.
    if (mentionRef.current?.onKeyDown(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (value.trim()) send.mutate();
    } else if (e.key === 'Escape' && replyTo && onCancelReply) {
      e.preventDefault();
      onCancelReply();
    }
  };

  const handleMentionInsert = (start: number, end: number, replacement: string) => {
    const next = value.slice(0, start) + replacement + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = start + replacement.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
        setCaret(pos);
      }
    });
  };

  return (
    <div className="relative">
      {replyTo ? (
        <div className="mb-2 flex items-center justify-between rounded border border-brand-blue/30 bg-brand-blue-50 px-3 py-2 text-[12px] text-ink">
          <span>
            Replying to <strong>{replyTo.author.name}</strong>:{' '}
            <span className="text-ink-2 line-clamp-1">
              {replyTo.markdown.replace(/@\[[^\]]+\]\([^)]+\)/g, '@…').slice(0, 120)}
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-2 inline-grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-line"
            aria-label="Cancel reply"
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        onKeyDown={handleKeyDown}
        placeholder={
          replyTo
            ? `Reply to ${replyTo.author.name}…`
            : 'Write a comment. ⌘/Ctrl + Enter to send. Use @ to mention.'
        }
        rows={3}
        className={cn('resize-y text-[14px]', send.isPending && 'opacity-60')}
        disabled={send.isPending}
      />

      <MentionSuggest
        ref={mentionRef}
        value={value}
        caret={caret}
        projectSlug={projectSlug}
        onSelect={handleMentionInsert}
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="text-[11px] text-ink-3">⌘/Ctrl + Enter to send</span>
        <Button
          size="sm"
          onClick={() => send.mutate()}
          disabled={!value.trim() || send.isPending}
          loading={send.isPending}
        >
          <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
          {replyTo ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Send, X, Reply as ReplyIcon, Paperclip, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadToPresigned } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  ChatAttachmentKind,
  ChatAttachmentPresign,
  ChatGif,
  ChatLinkPreview,
  ChatMessage,
} from '@/lib/types';
import { AttachmentRenderer } from './attachment-renderer';
import { ComposerPicker } from './composer-picker';
import { LinkPreviewCard } from './link-preview-card';
import { MentionSuggest, type MentionSuggestHandle } from './mention-suggest';

interface Props {
  projectSlug: string;
  channelId: string;
  channelName: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  /** Called on each keystroke. Throttled to once per 2s server-side. */
  onTyping?: () => void;
  /** Called when the user clears the draft or sends. */
  onTypingStop?: () => void;
}

interface PendingAttachment {
  id: string;
  filename: string;
  kind: ChatAttachmentKind;
  url: string | null;
  s3Key: string | null;
  mime: string;
  bytes: number;
  progress: number;
  error?: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/;

/**
 * Composer with:
 *   - Plain markdown textarea (Enter sends, Shift+Enter newline)
 *   - Reply banner above input when replyTo is set
 *   - Attachment tray with drag-drop / paste-image / button — uses
 *     the chat-attachment presign endpoint and uploads to S3 directly
 *   - Paste-URL → server-side OG link preview as a removable card.
 *     Only fires on PASTE (per spec), not on typed URLs or edits.
 *   - Emoji / GIF / Sticker picker
 *
 * Send body is always `{ markdown, replyToId, attachments[] }`. The
 * link preview is a sender-side affordance only — its URL stays in
 * the markdown so the recipient gets a clickable link.
 */
export function MessageComposer({
  projectSlug,
  channelId,
  channelName,
  replyTo,
  onClearReply,
  onTyping,
  onTypingStop,
}: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState('');
  const [caret, setCaret] = React.useState(0);
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [preview, setPreview] = React.useState<ChatLinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const seenPreviewUrlsRef = React.useRef<Set<string>>(new Set());
  const mentionRef = React.useRef<MentionSuggestHandle>(null);

  const trackCaret = React.useCallback(() => {
    if (textareaRef.current) setCaret(textareaRef.current.selectionStart ?? 0);
  }, []);

  const replaceRange = React.useCallback(
    (start: number, end: number, replacement: string) => {
      setDraft((d) => d.slice(0, start) + replacement + d.slice(end));
      const next = start + replacement.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.selectionStart = el.selectionEnd = next;
        setCaret(next);
      });
    },
    [],
  );

  React.useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const ready = attachments.every((a) => a.url && !a.error);
  const hasContent = draft.trim().length > 0 || attachments.length > 0;

  const sendMutation = useMutation({
    mutationFn: () =>
      api(apiPaths.chat.messages(projectSlug, channelId), {
        method: 'POST',
        body: {
          markdown: draft.trim(),
          replyToId: replyTo?.id,
          attachments: attachments
            .filter((a) => a.url && a.s3Key)
            .map((a) => ({
              kind: a.kind,
              url: a.url,
              s3Key: a.s3Key,
              mime: a.mime,
              bytes: a.bytes,
            })),
          clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      }),
    onSuccess: () => {
      setDraft('');
      setAttachments([]);
      setPreview(null);
      seenPreviewUrlsRef.current.clear();
      onClearReply();
      onTypingStop?.();
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(channelId) });
    },
  });

  const submit = () => {
    if (!hasContent || !ready || sendMutation.isPending) return;
    sendMutation.mutate();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let the mention popover handle navigation / commit when it's open.
    if (mentionRef.current?.onKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setDraft(next);
    setCaret(e.target.selectionStart ?? next.length);
    if (next.trim().length > 0) onTyping?.();
    else onTypingStop?.();
  };

  // ─── Paste handler: image → upload, URL → preview ────────────────────
  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Image paste — upload as attachment.
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length > 0) {
      e.preventDefault();
      for (const f of files) await uploadOne(f);
      return;
    }
    // URL paste — debounce a link-preview fetch.
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const match = text.match(URL_REGEX);
    if (match) {
      const url = match[0];
      if (!seenPreviewUrlsRef.current.has(url) && !preview) {
        seenPreviewUrlsRef.current.add(url);
        fetchPreview(url);
      }
    }
  };

  const fetchPreview = async (url: string) => {
    setPreviewLoading(true);
    try {
      const result = await api<ChatLinkPreview>(apiPaths.chat.linkPreview(), {
        method: 'POST',
        body: { url },
      });
      // Only show meaningful previews — bare-link results are noise.
      if (result.title || result.description || result.imageUrl) {
        setPreview(result);
      }
    } catch {
      // silently drop — link still in text
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Attachment upload ──────────────────────────────────────────────
  const uploadOne = async (file: File) => {
    const tempId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const placeholder: PendingAttachment = {
      id: tempId,
      filename: file.name,
      kind: 'FILE',
      url: null,
      s3Key: null,
      mime: file.type || 'application/octet-stream',
      bytes: file.size,
      progress: 0,
    };
    setAttachments((prev) => [...prev, placeholder]);
    try {
      const presign = await api<ChatAttachmentPresign>(
        apiPaths.chat.presignAttachment(projectSlug, channelId),
        {
          method: 'POST',
          body: {
            contentType: file.type || 'application/octet-stream',
            contentLength: file.size,
            filename: file.name,
          },
        },
      );
      await uploadToPresigned(presign.uploadUrl, file, (pct) => {
        setAttachments((prev) => prev.map((a) => (a.id === tempId ? { ...a, progress: pct } : a)));
      });
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === tempId
            ? { ...a, url: presign.publicUrl, s3Key: presign.s3Key, kind: presign.kind, progress: 100 }
            : a,
        ),
      );
    } catch (err) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === tempId ? { ...a, error: (err as Error).message ?? 'Upload failed' } : a,
        ),
      );
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of files) await uploadOne(f);
  };

  // ─── Drag-and-drop ──────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragging(true);
    }
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    for (const f of files) await uploadOne(f);
  };

  // ─── Picker callbacks ───────────────────────────────────────────────
  const insertAtCaret = (text: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => d + text);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + text + draft.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const onGifPick = (gif: ChatGif) => {
    // GIF URLs render as inline images via embed-renderer's detection.
    insertAtCaret((draft ? '\n' : '') + gif.gifUrl + '\n');
  };

  return (
    <div
      className={cn(
        'relative border-t border-line bg-white px-6 py-3 transition-colors',
        isDragging && 'bg-brand-blue/5',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragging ? (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-lg border-2 border-dashed border-brand-blue/60 bg-brand-blue/5 text-[14px] font-medium text-brand-blue">
          Drop files to attach
        </div>
      ) : null}

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

      {preview || previewLoading ? (
        <div className="mb-2">
          {preview ? (
            <LinkPreviewCard preview={preview} onRemove={() => setPreview(null)} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-white p-2 text-[12px] text-ink-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Fetching link preview…
            </div>
          )}
        </div>
      ) : null}

      {attachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              att={a}
              onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
            />
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2 rounded-lg border border-line bg-white p-2 focus-within:border-line-strong">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" strokeWidth={2.25} />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void onPickFiles(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <ComposerPicker
          onEmojiPick={(emoji) => insertAtCaret(emoji)}
          onGifPick={onGifPick}
        />
        <div className="relative flex-1">
          <MentionSuggest
            ref={mentionRef}
            value={draft}
            caret={caret}
            projectSlug={projectSlug}
            onSelect={replaceRange}
          />
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={trackCaret}
            onClick={trackCaret}
            onSelect={trackCaret}
            onPaste={onPaste}
            rows={Math.min(6, Math.max(1, draft.split('\n').length))}
            placeholder={`Message #${channelName}`}
            className="block w-full resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-ink-3"
          />
        </div>
        <Button
          size="icon-sm"
          onClick={submit}
          disabled={!hasContent || !ready || sendMutation.isPending}
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

function AttachmentChip({
  att,
  onRemove,
}: {
  att: PendingAttachment;
  onRemove: () => void;
}) {
  const uploading = att.progress < 100 && !att.error && !att.url;
  return (
    <div className="relative flex max-w-[200px] items-center gap-2 rounded-lg border border-line bg-surface-muted/40 px-2 py-1.5 text-[12px]">
      {att.url ? (
        <div className="max-w-[140px] truncate">
          <AttachmentRenderer
            attachment={{
              id: att.id,
              messageId: '',
              kind: att.kind,
              url: att.url,
              s3Key: att.s3Key ?? '',
              mime: att.mime,
              bytes: att.bytes,
              width: null,
              height: null,
              durationSec: null,
              posterUrl: null,
              createdAt: new Date().toISOString(),
            }}
          />
        </div>
      ) : (
        <span className="max-w-[140px] truncate text-ink-2">{att.filename}</span>
      )}
      {uploading ? <Loader2 className="h-3 w-3 animate-spin text-ink-3" /> : null}
      {att.error ? <span className="text-brand-red">{att.error}</span> : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="ml-1 inline-grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-white hover:text-ink"
      >
        <X className="h-3 w-3" strokeWidth={2.25} />
      </button>
    </div>
  );
}

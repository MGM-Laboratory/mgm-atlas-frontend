'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, WifiOff } from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  type PartialBlock,
} from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getYjsWsUrl } from '@/lib/hooks/use-pmo-enabled';
import { createYjsConnection, cursorColorFor, type YjsConnection } from '@/lib/yjs/provider';
import { cn } from '@/lib/utils';
import type { ProjectNote, SessionUser, YjsTokenResponse } from '@/lib/types';

/**
 * One mounted BlockNote editor per open note. The parent remounts this
 * (keyed by noteId) when the selection changes, so the Yjs connection and
 * editor instance are always created fresh for the active note.
 *
 * When NEXT_PUBLIC_YJS_WS_URL is set we edit collaboratively through the
 * y-websocket sidecar (live cursors via awareness). When it's empty we fall
 * back to a single-user editor seeded from the saved snapshot — edits still
 * persist via the debounced contentSnapshot PATCH.
 */
export function NoteEditor({
  projectSlug,
  noteId,
  user,
}: {
  projectSlug: string;
  noteId: string;
  user: SessionUser;
}) {
  const tokenQuery = useQuery({
    queryKey: ['pmo', 'note-token', projectSlug, noteId],
    queryFn: () => api<YjsTokenResponse>(apiPaths.pmo.notes.yjsToken(projectSlug, noteId)),
    refetchOnWindowFocus: false,
    staleTime: 90 * 60 * 1000,
  });

  const wsBase = getYjsWsUrl() || tokenQuery.data?.wsUrl || '';

  // Single-user fallback seeds the editor from the stored projection.
  const noteQuery = useQuery({
    queryKey: queryKeys.pmo.note(projectSlug, noteId),
    queryFn: () => api<ProjectNote>(apiPaths.pmo.notes.one(projectSlug, noteId)),
    enabled: !wsBase && !!tokenQuery.data,
    refetchOnWindowFocus: false,
  });

  if (tokenQuery.isLoading || (!wsBase && !!tokenQuery.data && noteQuery.isLoading)) {
    return <EditorLoading />;
  }
  if (tokenQuery.isError || !tokenQuery.data) {
    return <EditorMessage>Couldn’t open this note.</EditorMessage>;
  }

  return (
    <BlockNoteEditor
      projectSlug={projectSlug}
      noteId={noteId}
      user={user}
      wsBase={wsBase}
      docKey={tokenQuery.data.docKey}
      token={tokenQuery.data.token}
      initialContent={asBlocks(noteQuery.data?.contentSnapshot)}
    />
  );
}

function asBlocks(snapshot: unknown): PartialBlock[] | undefined {
  return Array.isArray(snapshot) && snapshot.length ? (snapshot as PartialBlock[]) : undefined;
}

// Code block schema. We deliberately do NOT use @blocknote/code-block's
// Shiki-based highlighter — its `createHighlighter` loads the full Shiki
// engine + every grammar at first-block render and was freezing the main
// thread on lower-end devices (PMO notes crash report, 2026-05-31).
//
// Trade-off: no syntax token colours. The block still gets the IDE-style
// dark surface (via globals.css), a language dropdown (rendered by
// BlockNote core from this `supportedLanguages` list), and the
// MutationObserver-injected copy button. Highlighting can return later
// behind a dynamic `import('@blocknote/code-block')` triggered only
// when the user actually picks a non-`text` language.
//
// Existing notes that have language="rust" etc. continue to render —
// BlockNote falls back to plain text if the language isn't in our list.
const SUPPORTED_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  text: { name: 'Auto / Plain text', aliases: ['plain', 'plaintext'] },
  bash: { name: 'Bash', aliases: ['sh', 'shell', 'zsh'] },
  c: { name: 'C' },
  cpp: { name: 'C++', aliases: ['c++'] },
  csharp: { name: 'C#', aliases: ['cs'] },
  css: { name: 'CSS' },
  diff: { name: 'Diff' },
  dockerfile: { name: 'Dockerfile', aliases: ['docker'] },
  go: { name: 'Go', aliases: ['golang'] },
  graphql: { name: 'GraphQL' },
  html: { name: 'HTML' },
  ini: { name: 'INI' },
  java: { name: 'Java' },
  javascript: { name: 'JavaScript', aliases: ['js'] },
  json: { name: 'JSON' },
  kotlin: { name: 'Kotlin', aliases: ['kt'] },
  lua: { name: 'Lua' },
  markdown: { name: 'Markdown', aliases: ['md'] },
  php: { name: 'PHP' },
  python: { name: 'Python', aliases: ['py'] },
  ruby: { name: 'Ruby', aliases: ['rb'] },
  rust: { name: 'Rust', aliases: ['rs'] },
  scss: { name: 'SCSS', aliases: ['sass'] },
  sql: { name: 'SQL' },
  swift: { name: 'Swift' },
  toml: { name: 'TOML' },
  tsx: { name: 'TSX' },
  typescript: { name: 'TypeScript', aliases: ['ts'] },
  vue: { name: 'Vue' },
  xml: { name: 'XML' },
  yaml: { name: 'YAML', aliases: ['yml'] },
};

const noteSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({
      defaultLanguage: 'text',
      indentLineWithTab: true,
      supportedLanguages: SUPPORTED_LANGUAGES,
      // No `createHighlighter` — the Shiki engine load was the freeze cause.
    }),
  },
});

function BlockNoteEditor({
  projectSlug,
  noteId,
  user,
  wsBase,
  docKey,
  token,
  initialContent,
}: {
  projectSlug: string;
  noteId: string;
  user: SessionUser;
  wsBase: string;
  docKey: string;
  token: string;
  initialContent: PartialBlock[] | undefined;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<'connecting' | 'connected' | 'offline'>(
    wsBase ? 'connecting' : 'offline',
  );

  // Created exactly once for this mounted note.
  const connRef = React.useRef<YjsConnection | null>(null);
  if (wsBase && connRef.current === null) {
    connRef.current = createYjsConnection(wsBase, docKey, token);
  }
  const conn = connRef.current;

  React.useEffect(() => {
    if (!conn) return;
    const onStatus = (e: { status: string }) =>
      setStatus(e.status === 'connected' ? 'connected' : 'connecting');
    conn.provider.on('status', onStatus);
    return () => {
      conn.provider.off('status', onStatus);
      conn.provider.destroy();
      conn.doc.destroy();
    };
  }, [conn]);

  React.useEffect(() => {
    if (!conn) return;
    conn.provider.awareness.setLocalStateField('user', {
      name: user.name,
      color: cursorColorFor(user.id),
    });
  }, [conn, user.name, user.id]);

  const editor = useCreateBlockNote(
    conn
      ? {
          schema: noteSchema,
          collaboration: {
            provider: conn.provider,
            fragment: conn.doc.getXmlFragment('document-store'),
            user: { name: user.name, color: cursorColorFor(user.id) },
          },
        }
      : { schema: noteSchema, initialContent },
  );

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const persist = React.useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void api(apiPaths.pmo.notes.update(projectSlug, noteId), {
        method: 'PATCH',
        body: { contentSnapshot: editor.document },
      })
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) }))
        .catch(() => {});
    }, 1500);
  }, [editor, projectSlug, noteId, queryClient]);

  React.useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Attach a copy button to each rendered code block. BlockNote doesn't ship
  // one, so we observe the editor DOM and inject a button into the block
  // wrapper. The button reads text from the `<code>` element so it stays
  // accurate as the user edits.
  const editorWrapRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const root = editorWrapRef.current;
    if (!root) return;
    const attach = (block: HTMLElement) => {
      if (block.querySelector(':scope > .bn-code-copy-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bn-code-copy-btn';
      btn.contentEditable = 'false';
      btn.setAttribute('aria-label', 'Copy code');
      btn.textContent = 'Copy';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = block.querySelector('pre code') as HTMLElement | null;
        const text = code?.innerText ?? '';
        const done = () => {
          btn.textContent = 'Copied';
          btn.classList.add('is-copied');
          window.setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('is-copied');
          }, 1400);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(() => {});
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            done();
          } finally {
            document.body.removeChild(ta);
          }
        }
      });
      block.appendChild(btn);
    };
    const scan = () => {
      root
        .querySelectorAll<HTMLElement>('.bn-block-content[data-content-type="codeBlock"]')
        .forEach(attach);
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-1 pb-2">
        <StatusPill status={status} />
      </div>
      <div
        ref={editorWrapRef}
        className="flex-1 overflow-auto rounded-lg border border-line bg-white"
      >
        <BlockNoteView editor={editor} theme="light" onChange={persist} className="py-3" />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'connecting' | 'connected' | 'offline' }) {
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3" title="Realtime collaboration is off — your edits are still saved to this note.">
        <WifiOff className="h-3.5 w-3.5" strokeWidth={2.25} />
        Offline
      </span>
    );
  }
  const connected = status === 'connected';
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          connected ? 'bg-brand-green' : 'animate-pulse bg-brand-yellow',
        )}
      />
      {connected ? 'Live' : 'Connecting…'}
    </span>
  );
}

function EditorLoading() {
  return (
    <div className="flex h-full items-center justify-center text-ink-3">
      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
    </div>
  );
}

function EditorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
        {children}
      </p>
    </div>
  );
}

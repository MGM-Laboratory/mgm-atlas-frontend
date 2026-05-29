'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, WifiOff } from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import type { PartialBlock } from '@blocknote/core';
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
          collaboration: {
            provider: conn.provider,
            fragment: conn.doc.getXmlFragment('document-store'),
            user: { name: user.name, color: cursorColorFor(user.id) },
          },
        }
      : { initialContent },
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end px-1 pb-2">
        <StatusPill status={status} />
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-line bg-white">
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

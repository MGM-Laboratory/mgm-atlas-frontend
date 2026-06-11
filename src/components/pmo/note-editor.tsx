'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Loader2, WifiOff } from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/ariakit';
import { type PartialBlock } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/ariakit/style.css';
import { api, apiBeacon } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { queryKeys } from '@/lib/api/queries';
import { getYjsWsUrl } from '@/lib/hooks/use-pmo-enabled';
import { createYjsConnection, cursorColorFor, type YjsConnection } from '@/lib/yjs/provider';
import { useSaveSurface, SaveBadge } from '@/lib/save-coordinator';
import { RevisionHistoryDrawer } from '@/components/pmo/revision-history-drawer';
import { Button } from '@/components/ui/button';
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

  // Always fetch the stored projection — not just for offline mode.
  // In online (Yjs) mode it's used for auto-recovery when the Yjs
  // binary state is empty (lost to the PR1 sidecar race) but the
  // JSON projection still has the user's real content. See the
  // recovery logic inside BlockNoteEditor for details.
  const noteQuery = useQuery({
    queryKey: queryKeys.pmo.note(projectSlug, noteId),
    queryFn: () => api<ProjectNote>(apiPaths.pmo.notes.one(projectSlug, noteId)),
    enabled: !!tokenQuery.data,
    refetchOnWindowFocus: false,
  });

  if (tokenQuery.isLoading || (!!tokenQuery.data && noteQuery.isLoading)) {
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

/**
 * True when the editor's current document is effectively blank —
 * either an empty array, or a single paragraph with no inline content.
 * Used to decide whether to auto-restore from the JSON projection.
 */
function documentLooksEmpty(doc: readonly unknown[]): boolean {
  if (!Array.isArray(doc) || doc.length === 0) return true;
  if (doc.length > 1) return false;
  const only = doc[0] as { type?: string; content?: unknown } | null;
  if (!only) return true;
  if (only.type !== 'paragraph') return false;
  const c = only.content;
  if (!Array.isArray(c)) return true;
  if (c.length === 0) return true;
  // BlockNote often stores a single text-run with empty string when "empty".
  return c.every((node) => {
    const n = node as { type?: string; text?: string };
    return n && (n.type !== 'text' || !n.text || n.text.length === 0);
  });
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
    // `id` is consumed by the y-websocket sidecar to attribute the
    // next YDocSnapshotRevision row to the right user (PR2). Don't
    // drop it without coordinating with the sidecar.
    conn.provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: cursorColorFor(user.id),
    });
  }, [conn, user.name, user.id]);

  // Use BlockNote's default block schema. The previous custom schema
  // configured `codeBlock` with `supportedLanguages` (rendering a 30-option
  // <select> on every code-block render) which, combined with the
  // MutationObserver-injected copy button below, was freezing the editor
  // — every block re-render kicked the observer, which mutated the DOM,
  // which kicked another re-render. Going back to defaults eliminates the
  // feedback loop. Dark styling stays on via CSS in globals.css.
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

  const surfaceId = `note:${noteId}`;
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDoc = React.useRef<unknown>(undefined);
  const lastFlushedDoc = React.useRef<string | undefined>(undefined);

  // CRITICAL: gate every save on the Yjs initial sync.
  //
  // BlockNote's onChange fires for BOTH local edits and remote Yjs
  // updates. Between mount and the first 'sync' from the provider,
  // the editor briefly holds its empty default state — then the
  // server snapshot arrives and onChange fires with the real
  // content. If we treated the empty-state onChange as a user edit
  // and the user switched tabs (visibilitychange) or unmounted
  // before the snapshot landed, the beacon flush would PATCH the
  // EMPTY document back to the server and clobber their prior work.
  //
  // syncedRef is the source of truth for "is it safe to save?" —
  // checked inside flushDoc/persist via the ref (so the latest
  // value wins without re-creating closures). Offline mode (no
  // Yjs connection) starts synced=true since there's no remote
  // state to wait on.
  const [synced, setSynced] = React.useState<boolean>(!conn);
  const syncedRef = React.useRef<boolean>(!conn);
  React.useEffect(() => {
    syncedRef.current = synced;
  }, [synced]);
  React.useEffect(() => {
    if (!conn) return;
    const onSync = (isSynced: boolean) => {
      if (isSynced) setSynced(true);
    };
    conn.provider.on('sync', onSync);
    // y-websocket sets `synced` true after first server message;
    // hot-reloads may already be past that point by the time we
    // attach. Pick it up if so.
    if (conn.provider.synced) setSynced(true);
    return () => {
      conn.provider.off('sync', onSync);
    };
  }, [conn]);

  // Auto-recovery from JSON projection.
  //
  // Some docs lost their binary Yjs state to the PR1 sidecar race
  // (writeState raced with a 250ms flush handler that wrote an
  // empty Y.Doc on top of the correct one). The JSON projection
  // (`ProjectNote.contentSnapshot`) wasn't affected by that bug.
  // Once Yjs has finished its initial sync, if the editor is
  // observably empty BUT we have a non-trivial contentSnapshot,
  // apply the snapshot via `replaceBlocks`. The change propagates
  // through Yjs → sidecar (now correctly persistent post-fix) →
  // `YDocSnapshot`, so subsequent loads return the right content.
  //
  // Runs at most once per mount via `recoveredRef` — if a real
  // collaborator wipes the doc later we don't fight them.
  const recoveredRef = React.useRef(false);
  React.useEffect(() => {
    if (!synced || !conn || recoveredRef.current) return;
    if (!initialContent || initialContent.length === 0) return;
    const live = editor.document;
    if (!documentLooksEmpty(live)) return;
    recoveredRef.current = true;
    try {
      editor.replaceBlocks(editor.document, initialContent);
    } catch {
      // Bad snapshot shape — ignore, leave editor blank rather than crash.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once recovery
  }, [synced, conn, editor]);

  // Reusable PATCH — exposed both to the regular debounce path and to
  // the sync flush-on-unmount/hide path (via apiBeacon w/ keepalive).
  const flushDoc = React.useCallback(
    (mode: 'async' | 'beacon') => {
      // Refuse to save until Yjs has finished its initial sync — see
      // the syncedRef comment above for why this matters.
      if (!syncedRef.current) {
        pendingDoc.current = undefined;
        return;
      }
      const doc = pendingDoc.current;
      if (doc === undefined) return;
      const serial = JSON.stringify(doc);
      if (serial === lastFlushedDoc.current) {
        // No payload diff since the last successful flush — clear dirty.
        pendingDoc.current = undefined;
        save.markSaved();
        return;
      }
      lastFlushedDoc.current = serial;
      pendingDoc.current = undefined;
      const path = apiPaths.pmo.notes.update(projectSlug, noteId);
      if (mode === 'beacon') {
        // Fire-and-forget via fetch keepalive — survives page unload.
        apiBeacon(path, { contentSnapshot: doc });
        save.markSaved();
        return;
      }
      save.markSaving();
      void api(path, { method: 'PATCH', body: { contentSnapshot: doc } })
        .then(() => {
          save.markSaved();
          queryClient.invalidateQueries({ queryKey: queryKeys.pmo.notes(projectSlug) });
        })
        .catch((err: unknown) => {
          // Put the doc back so a later flush retries.
          pendingDoc.current = doc;
          lastFlushedDoc.current = undefined;
          save.markError(err instanceof Error ? err.message : 'Save failed');
        });
    },
    // `save` is intentionally excluded: its identity is stable
    // across renders (zustand `setStatus` reference is stable and
    // `useSaveSurface` returns a memoized object), and re-creating
    // flushDoc on every render would invalidate the BlockNote
    // onChange callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectSlug, noteId, queryClient],
  );

  // `save` must be defined AFTER flushDoc so flushNow can call it,
  // but flushDoc calls save.markSaving / markError. We resolve the
  // cycle by reading from a ref captured below.
  const save = useSaveSurface({
    surfaceId,
    flushNow: () => flushDoc('beacon'),
  });

  const persist = React.useCallback(
    () => {
      // Ignore onChange callbacks fired by the initial Yjs sync
      // arriving from the server. The editor briefly shows its
      // empty default state at mount and BlockNote fires onChange
      // for the remote merge that follows — treating that as a
      // user edit would queue an empty-document save.
      if (!syncedRef.current) return;
      pendingDoc.current = editor.document;
      save.markDirty();
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushDoc('async'), 1500);
    },
    // `save`'s identity is stable across renders (useMemo over a
    // stable setStatus reference), so it's intentionally not listed
    // — including it would force a new persist callback on every
    // re-render which BlockNoteView treats as a config change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, flushDoc],
  );

  React.useEffect(
    () => () => {
      // On unmount: flush whatever is pending via beacon so the
      // in-flight debounce doesn't get clipped. useSaveSurface also
      // calls flushNow on unmount, but doing both is harmless — the
      // beacon path is idempotent (deduped via lastFlushedDoc).
      clearTimeout(saveTimer.current);
      flushDoc('beacon');
    },
    [flushDoc],
  );

  // Block edits while the Yjs provider is still negotiating its first
  // sync — typing into the doc before the server snapshot arrives risks
  // having those keystrokes silently dropped on the next merge, and
  // showing a frozen-looking editor is confusing. The single-user
  // ("offline") path doesn't have a connecting window — it boots with
  // `initialContent` already populated.
  const isLoading = status === 'connecting';
  const [historyOpen, setHistoryOpen] = React.useState(false);

  // Roll the BlockNote editor's content to a snapshot loaded from the
  // History drawer. For collaborative docs this mutates the bound Yjs
  // doc so the change propagates to all connected clients; for single-
  // user (offline) mode it just replaces local state.
  const applySnapshot = React.useCallback(
    (snapshot: unknown) => {
      if (!Array.isArray(snapshot) || snapshot.length === 0) return;
      try {
        const blocks = snapshot as PartialBlock[];
        editor.replaceBlocks(editor.document, blocks);
      } catch {
        // BlockNote may reject malformed snapshots; ignore — the
        // server already wrote a new revision pointing at this
        // content, so the user can refresh to see it.
      }
    },
    [editor],
  );

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-end gap-3 px-1 pb-2">
        <SaveBadge surfaceId={surfaceId} />
        <StatusPill status={status} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-pressed={historyOpen}
        >
          <Clock className="h-3.5 w-3.5" strokeWidth={2.25} /> History
        </Button>
      </div>
      <div className="relative flex-1 overflow-auto rounded-lg border border-line bg-white">
        <BlockNoteView
          editor={editor}
          theme="light"
          onChange={persist}
          editable={!isLoading}
          className="py-3"
        />
        {isLoading ? <NoteLoadingOverlay /> : null}
      </div>
      <RevisionHistoryDrawer
        kind="note"
        projectSlug={projectSlug}
        parentId={noteId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={applySnapshot}
      />
    </div>
  );
}

/**
 * Centred spinner overlay shown while the Yjs provider hasn't completed
 * its first sync. `inset-0` + `bg-white/85` covers the empty editor
 * underneath so the user doesn't see a blank canvas they'll be tempted
 * to type into. The overlay catches pointer events too — belt-and-braces
 * even though the editor is already `editable={false}` — so stray clicks
 * on the toolbar area also bounce.
 */
function NoteLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/85 backdrop-blur-[2px]"
    >
      <Loader2 className="h-5 w-5 animate-spin text-brand-blue" strokeWidth={2.25} />
      <span className="text-[13px] font-medium text-ink-2">Loading note…</span>
      <span className="text-[12px] text-ink-3">Hold tight — syncing the latest version.</span>
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

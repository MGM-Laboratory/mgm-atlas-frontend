'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Download, Eye, Loader2, Pencil, Upload, WifiOff } from 'lucide-react';
import { api } from '@/lib/api/client';
import { apiPaths } from '@/lib/api/paths';
import { getYjsWsUrl } from '@/lib/hooks/use-pmo-enabled';
import { createYjsConnection, cursorColorFor, type YjsConnection } from '@/lib/yjs/provider';
import {
  ExcalidrawYjsBinding,
  type ExcalidrawApiLike,
  type ExElement,
} from '@/lib/yjs/excalidraw-binding';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { SessionUser, Whiteboard, YjsTokenResponse } from '@/lib/types';

export function WhiteboardCanvas({
  projectSlug,
  wbId,
  user,
}: {
  projectSlug: string;
  wbId: string;
  user: SessionUser;
}) {
  const { show } = useToast();
  const apiRef = React.useRef<ExcalidrawApiLike | null>(null);
  const connRef = React.useRef<YjsConnection | null>(null);
  const bindingRef = React.useRef<ExcalidrawYjsBinding | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [status, setStatus] = React.useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [viewMode, setViewMode] = React.useState(false);

  const tokenQuery = useQuery({
    queryKey: ['pmo', 'wb-token', projectSlug, wbId],
    queryFn: () => api<YjsTokenResponse>(apiPaths.pmo.whiteboards.yjsToken(projectSlug, wbId)),
    refetchOnWindowFocus: false,
    staleTime: 90 * 60 * 1000,
  });
  const wsBase = getYjsWsUrl() || tokenQuery.data?.wsUrl || '';

  React.useEffect(() => {
    return () => {
      clearTimeout(saveTimer.current);
      bindingRef.current?.destroy();
      connRef.current?.provider.destroy();
      connRef.current?.doc.destroy();
    };
  }, []);

  // Once both the Excalidraw API and the token are ready, wire the Yjs binding.
  const tryBind = React.useCallback(() => {
    if (bindingRef.current || !apiRef.current || !tokenQuery.data) return;
    if (!wsBase) {
      setStatus('offline');
      return;
    }
    const conn = createYjsConnection(wsBase, tokenQuery.data.docKey, tokenQuery.data.token);
    connRef.current = conn;
    conn.provider.on('status', (e: { status: string }) =>
      setStatus(e.status === 'connected' ? 'connected' : 'connecting'),
    );
    bindingRef.current = new ExcalidrawYjsBinding(conn.doc, conn.provider, apiRef.current, {
      name: user.name,
      color: cursorColorFor(user.id),
    });
  }, [tokenQuery.data, wsBase, user]);

  React.useEffect(() => {
    tryBind();
  }, [tryBind]);

  const persistSnapshot = React.useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const exApi = apiRef.current;
      if (!exApi) return;
      const scene = {
        type: 'excalidraw',
        version: 2,
        elements: exApi.getSceneElementsIncludingDeleted(),
        appState: { viewBackgroundColor: exApi.getAppState().viewBackgroundColor ?? '#ffffff' },
        files: exApi.getFiles(),
      };
      void api(apiPaths.pmo.whiteboards.update(projectSlug, wbId), {
        method: 'PATCH',
        body: { sceneSnapshot: scene },
      }).catch(() => {});
    }, 2000);
  }, [projectSlug, wbId]);

  const handleChange = React.useCallback(
    (elements: readonly ExElement[]) => {
      const all = apiRef.current?.getSceneElementsIncludingDeleted() ?? elements;
      bindingRef.current?.pushLocal(all);
      persistSnapshot();
    },
    [persistSnapshot],
  );

  const exportMgm = React.useCallback(() => {
    const exApi = apiRef.current;
    if (!exApi) return;
    const mgm = {
      format: 'mgm.whiteboard',
      version: 1,
      exportedAt: new Date().toISOString(),
      atlas: { projectId: tokenQuery.data?.docKey ?? '', whiteboardId: wbId },
      scene: {
        type: 'excalidraw',
        version: 2,
        elements: exApi.getSceneElementsIncludingDeleted(),
        appState: { viewBackgroundColor: exApi.getAppState().viewBackgroundColor ?? '#ffffff' },
        files: exApi.getFiles(),
      },
      mentions: [],
    };
    const blob = new Blob([JSON.stringify(mgm, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${wbId}.mgm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tokenQuery.data, wbId]);

  const importMgm = React.useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as {
          format?: string;
          scene?: { elements?: ExElement[] };
        };
        const elements = parsed?.scene?.elements;
        if (parsed.format !== 'mgm.whiteboard' || !Array.isArray(elements)) {
          throw new Error('Not a valid .mgm whiteboard file.');
        }
        if (!window.confirm('Importing replaces the current whiteboard for everyone. Continue?')) {
          return;
        }
        bindingRef.current?.replaceAll(elements);
        persistSnapshot();
        show({ tone: 'success', title: 'Whiteboard imported' });
      } catch (err) {
        show({ tone: 'danger', title: 'Import failed', description: (err as Error).message });
      }
    },
    [persistSnapshot, show],
  );

  if (tokenQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-ink-3">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.25} />
      </div>
    );
  }
  if (tokenQuery.isError || !tokenQuery.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="rounded border border-line bg-surface-muted p-4 text-[13px] text-brand-red">
          Couldn’t open this whiteboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-2">
        <StatusPill status={status} />
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setViewMode((v) => !v)}>
            {viewMode ? (
              <>
                <Pencil className="h-4 w-4" strokeWidth={2.25} /> Edit
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" strokeWidth={2.25} /> View
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" strokeWidth={2.25} /> Import
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={exportMgm}>
            <Download className="h-4 w-4" strokeWidth={2.25} /> Export .mgm
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mgm,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importMgm(f);
            }}
          />
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-lg border border-line">
        <Excalidraw
          excalidrawAPI={(exApi) => {
            apiRef.current = exApi as unknown as ExcalidrawApiLike;
            tryBind();
          }}
          onChange={(elements) => handleChange(elements as unknown as readonly ExElement[])}
          onPointerUpdate={(payload) =>
            bindingRef.current?.pushPointer(payload.pointer, String(payload.button))
          }
          viewModeEnabled={viewMode}
          isCollaborating
        />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'connecting' | 'connected' | 'offline' }) {
  if (status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
        <WifiOff className="h-3.5 w-3.5" strokeWidth={2.25} /> Offline
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

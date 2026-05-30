import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export interface YjsConnection {
  doc: Y.Doc;
  provider: WebsocketProvider;
}

/**
 * Connect a fresh Y.Doc to the self-hosted y-websocket sidecar for `docKey`
 * (e.g. "note:<id>"). `wsBaseUrl` is the public sidecar URL
 * (NEXT_PUBLIC_YJS_WS_URL, e.g. "wss://atlas.labmgm.org/yjs"); the provider
 * appends the room + the `token` query param the sidecar forwards to the
 * backend authorize callback. The caller owns teardown (destroy both).
 */
export function createYjsConnection(
  wsBaseUrl: string,
  docKey: string,
  token: string,
): YjsConnection {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(wsBaseUrl, docKey, doc, {
    connect: true,
    params: { token },
  });
  return { doc, provider };
}

const CURSOR_COLORS = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
];

/** Stable per-user cursor color so a person keeps the same color across sessions. */
export function cursorColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

'use client';

/**
 * IndexedDB mirror of the user's sessionId, used by the service worker
 * to authenticate the quick-reply POST. The SW can't read localStorage
 * (where the app keeps `atlas_session`), but it CAN read IndexedDB —
 * so we mirror just the sessionId string to a single-key store keyed
 * to the user.
 *
 * Stored deliberately separately from `atlas_session` localStorage so:
 *   1. The same browser used by a different user (incognito etc.)
 *      can't accidentally inherit a stale sessionId.
 *   2. Clearing browser cookies / site data wipes both.
 *
 * Only the sessionId is stored — not the user object or the Keycloak
 * tokens. That keeps the SW's blast radius minimal: a leaked SW can
 * only impersonate the current session, not derive long-lived refresh
 * material.
 */

const DB_NAME = 'atlas-auth';
const STORE_NAME = 'kv';
const DB_VERSION = 1;
const KEY = 'sessionId';

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function writeKey(value: string | null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (value === null) store.delete(KEY);
    else store.put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

/** Mirror the current sessionId into IndexedDB. Best-effort; never throws. */
export async function syncSessionToIdb(sessionId: string | null): Promise<void> {
  try {
    await writeKey(sessionId);
  } catch {
    // The SW only uses this for quick-reply; failure here just means
    // quick-reply will 401 and the SW will fall back to focus-input.
  }
}

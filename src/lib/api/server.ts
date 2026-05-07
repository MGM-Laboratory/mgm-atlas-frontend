import { cache } from 'react';
import { auth } from '@/auth';
import { ApiError } from './error';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Disable Next.js fetch caching (default: 'no-store'). */
  cache?: RequestCache;
  /** Tags for revalidatePath/Tag. */
  tags?: string[];
}

/** Server-only fetch wrapper that injects the Keycloak access token. */
export async function api<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const session = await auth();
  const headers = new Headers(opts.headers);
  if (!headers.has('content-type') && opts.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? 'no-store',
    next: opts.tags ? { tags: opts.tags } : undefined,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** RSC-cached GET — dedupes per request. */
export const apiGet = cache(<T>(path: string) => api<T>(path));

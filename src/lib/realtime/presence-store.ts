'use client';

import { create } from 'zustand';

interface TypingState {
  userId: string;
  name: string;
  expiresAt: number;
}

interface PresenceState {
  /** Map keyed by `${channelId}` → list of typing users. Cleared on stop or expiry. */
  typing: Record<string, TypingState[]>;
  /** Map keyed by `${projectId}` → set of online userIds. */
  online: Record<string, Set<string>>;

  addTyping: (channelId: string, user: { userId: string; name: string }) => void;
  removeTyping: (channelId: string, userId: string) => void;
  pruneExpiredTyping: () => void;

  setOnline: (projectId: string, userId: string, online: boolean) => void;
}

/**
 * Tiny global store for the *ephemeral* chat UI state — typing
 * indicators and presence dots. Persistent data (messages, channels,
 * reactions) lives in React Query; mixing them would invalidate
 * caches every keystroke from another user.
 *
 * The socket layer writes into this store; components subscribe with
 * the usual Zustand selector hooks.
 */
export const usePresenceStore = create<PresenceState>((set, get) => ({
  typing: {},
  online: {},

  addTyping: (channelId, user) => {
    const list = get().typing[channelId] ?? [];
    const filtered = list.filter((t) => t.userId !== user.userId);
    filtered.push({ userId: user.userId, name: user.name, expiresAt: Date.now() + 7000 });
    set({ typing: { ...get().typing, [channelId]: filtered } });
  },

  removeTyping: (channelId, userId) => {
    const list = get().typing[channelId] ?? [];
    set({
      typing: { ...get().typing, [channelId]: list.filter((t) => t.userId !== userId) },
    });
  },

  pruneExpiredTyping: () => {
    const now = Date.now();
    const next: Record<string, TypingState[]> = {};
    let changed = false;
    for (const [channelId, list] of Object.entries(get().typing)) {
      const kept = list.filter((t) => t.expiresAt > now);
      if (kept.length !== list.length) changed = true;
      if (kept.length > 0) next[channelId] = kept;
    }
    if (changed) set({ typing: next });
  },

  setOnline: (projectId, userId, online) => {
    const prev = get().online[projectId] ?? new Set();
    const next = new Set(prev);
    if (online) next.add(userId);
    else next.delete(userId);
    set({ online: { ...get().online, [projectId]: next } });
  },
}));

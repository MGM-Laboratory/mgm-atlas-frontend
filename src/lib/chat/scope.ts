import { apiPaths } from '@/lib/api/paths';

/**
 * Where a chat channel lives. Project channels use the existing
 * project-scoped REST routes; workspace-global channels (the workspace
 * #general, lobby voice text threads) use the channel-id-keyed routes
 * added alongside them. Components take a ChatScope instead of a bare
 * projectSlug so both kinds render through the same code path.
 */
export type ChatScope = { kind: 'project'; slug: string } | { kind: 'global' };

export function messagesPath(
  scope: ChatScope,
  channelId: string,
  cursor?: string,
  limit?: number,
): string {
  return scope.kind === 'project'
    ? apiPaths.chat.messages(scope.slug, channelId, cursor, limit)
    : apiPaths.chat.channelMessages(channelId, cursor, limit);
}

export function readPath(scope: ChatScope, channelId: string): string {
  return scope.kind === 'project'
    ? apiPaths.chat.read(scope.slug, channelId)
    : apiPaths.chat.channelRead(channelId);
}

export function statePath(scope: ChatScope, channelId: string): string {
  return scope.kind === 'project'
    ? apiPaths.chat.channelState(scope.slug, channelId)
    : apiPaths.chat.channelStateById(channelId);
}

export function pinsPath(scope: ChatScope, channelId: string): string {
  return scope.kind === 'project'
    ? apiPaths.chat.pins(scope.slug, channelId)
    : apiPaths.chat.channelPins(channelId);
}

export function presignPath(scope: ChatScope, channelId: string): string {
  return scope.kind === 'project'
    ? apiPaths.chat.presignAttachment(scope.slug, channelId)
    : apiPaths.chat.channelPresign(channelId);
}

export function membersPath(scope: ChatScope, q?: string): string {
  return scope.kind === 'project'
    ? apiPaths.chat.members(scope.slug, q)
    : apiPaths.chat.globalMembers(q);
}

/** In-app href for a channel under this scope. */
export function channelHref(scope: ChatScope, channelId: string): string {
  return scope.kind === 'project'
    ? `/projects/${scope.slug}/chat/${channelId}`
    : `/chat/global/${channelId}`;
}

/** In-app href for a search hit (global hits have no projectSlug). */
export function searchHitHref(projectSlug: string | null, channelId: string): string {
  return projectSlug ? `/projects/${projectSlug}/chat/${channelId}` : `/chat/global/${channelId}`;
}

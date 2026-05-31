import type { ProjectListFilters } from './queries';

export const apiPaths = {
  session: () => '/auth/session',
  me: () => '/users/me',
  dashboard: () => '/users/me/dashboard',
  bookmarks: () => '/users/me/bookmarks',
  bookmark: (projectId: string) => `/users/me/bookmarks/${projectId}`,
  users: (q?: string) => `/users${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  setAdmin: (id: string) => `/users/${id}/admin`,

  tags: () => '/tags',
  tagsGrouped: () => '/tags/grouped',
  tag: (id: string) => `/tags/${id}`,

  projects: (f: ProjectListFilters = {}) => {
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.phase?.length) params.set('phase', f.phase.join(','));
    if (f.tagIds?.length) params.set('tagIds', f.tagIds.join(','));
    if (f.recruitingFor) params.set('recruitingFor', f.recruitingFor);
    if (f.page) params.set('page', String(f.page));
    if (f.pageSize) params.set('pageSize', String(f.pageSize));
    if (f.sort) params.set('sort', f.sort);
    if (f.archived) params.set('archived', 'true');
    if (f.bookmarkedOnly) params.set('bookmarkedOnly', 'true');
    const qs = params.toString();
    return `/projects${qs ? `?${qs}` : ''}`;
  },
  discovery: () => '/projects/discover',
  featured: () => '/projects/featured',
  project: (slug: string) => `/projects/${slug}`,
  archiveProject: (id: string) => `/projects/${id}/archive`,
  unarchiveProject: (id: string) => `/projects/${id}/unarchive`,

  presignMedia: (projectId: string) => `/projects/${projectId}/media/presign`,
  registerMedia: (projectId: string) => `/projects/${projectId}/media`,
  reorderMedia: (projectId: string) => `/projects/${projectId}/media/reorder`,
  deleteMedia: (projectId: string, mediaId: string) =>
    `/projects/${projectId}/media/${mediaId}`,

  contribute: (slug: string) => `/projects/${slug}/contribute`,
  projectContributions: (slug: string, status?: string) =>
    `/projects/${slug}/contributions${status ? `?status=${status}` : ''}`,
  myContributions: () => '/contributions/mine',
  withdrawContribution: (id: string) => `/contributions/${id}/withdraw`,
  approveContribution: (id: string) => `/contributions/${id}/approve`,
  rejectContribution: (id: string) => `/contributions/${id}/reject`,

  invite: (projectId: string) => `/projects/${projectId}/invites`,
  revokeInvite: (projectId: string, inviteId: string) =>
    `/projects/${projectId}/invites/${inviteId}`,
  acceptInvite: (id: string) => `/invites/${id}/accept`,
  declineInvite: (id: string) => `/invites/${id}/decline`,
  member: (projectId: string, memberId: string) =>
    `/projects/${projectId}/members/${memberId}`,

  notifications: (page: number) => `/notifications?page=${page}&pageSize=20`,
  unreadCount: () => '/notifications/unread-count',
  markRead: (id: string) => `/notifications/${id}/read`,
  markAllRead: () => '/notifications/read-all',
  // ─── Web Push (Phase 3) ───────────────────────────────────────────
  vapidPublicKey: () => '/notifications/push/vapid-public-key',
  pushSubscribe: () => '/notifications/push/subscribe',
  pushSubscriptions: () => '/notifications/push/subscriptions',
  pushSubscriptionDelete: (id: string) => `/notifications/push/subscriptions/${id}`,
  notificationPreferences: () => '/notifications/preferences',

  collaborationRoles: () => '/admin/collaboration-roles',
  collaborationRole: (id: string) => `/admin/collaboration-roles/${id}`,

  health: () => '/health',

  // ─── Chat ──────────────────────────────────────────────────────────
  chat: {
    myProjects: () => '/chat/me/projects',
    channels: (projectSlugOrId: string) => `/projects/${projectSlugOrId}/chat/channels`,
    channel: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}`,
    archiveChannel: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/archive`,
    unarchiveChannel: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/unarchive`,
    messages: (projectSlugOrId: string, channelId: string, cursor?: string, limit?: number) => {
      const qs = new URLSearchParams();
      if (cursor) qs.set('cursor', cursor);
      if (limit) qs.set('limit', String(limit));
      const q = qs.toString();
      return `/projects/${projectSlugOrId}/chat/channels/${channelId}/messages${q ? `?${q}` : ''}`;
    },
    read: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/read`,
    channelState: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/state`,
    pins: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/pins`,
    editMessage: (messageId: string) => `/chat/messages/${messageId}`,
    deleteMessage: (messageId: string) => `/chat/messages/${messageId}`,
    addReaction: (messageId: string) => `/chat/messages/${messageId}/reactions`,
    removeReaction: (messageId: string, emoji: string) =>
      `/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
    pinMessage: (messageId: string) => `/chat/messages/${messageId}/pin`,
    unpinMessage: (messageId: string) => `/chat/messages/${messageId}/unpin`,
    forwardMessage: (messageId: string) => `/chat/messages/${messageId}/forward`,
    presignAttachment: (projectSlugOrId: string, channelId: string) =>
      `/projects/${projectSlugOrId}/chat/channels/${channelId}/attachments/presign`,
    linkPreview: () => '/chat/link-preview',
    gifsConfig: () => '/chat/gifs/config',
    gifsSearch: (q: string, pos?: string) => {
      const qs = new URLSearchParams({ q });
      if (pos) qs.set('pos', pos);
      return `/chat/gifs/search?${qs.toString()}`;
    },
    gifsTrending: (pos?: string) => `/chat/gifs/trending${pos ? `?pos=${encodeURIComponent(pos)}` : ''}`,
    members: (projectSlugOrId: string, q?: string) =>
      `/projects/${projectSlugOrId}/chat/members${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    stickerPacks: () => '/chat/stickers/packs',
    search: (params: {
      scope: 'channel' | 'project' | 'global';
      q: string;
      channelId?: string;
      projectId?: string;
      cursor?: string;
      limit?: number;
    }) => {
      const qs = new URLSearchParams({ scope: params.scope, q: params.q });
      if (params.channelId) qs.set('channelId', params.channelId);
      if (params.projectId) qs.set('projectId', params.projectId);
      if (params.cursor) qs.set('cursor', params.cursor);
      if (params.limit) qs.set('limit', String(params.limit));
      return `/chat/search?${qs.toString()}`;
    },
  },
  adminStickers: {
    packs: () => '/admin/stickers/packs',
    pack: (packId: string) => `/admin/stickers/packs/${packId}`,
    archivePack: (packId: string) => `/admin/stickers/packs/${packId}/archive`,
    unarchivePack: (packId: string) => `/admin/stickers/packs/${packId}/unarchive`,
    presignSticker: (packId: string) => `/admin/stickers/packs/${packId}/stickers/presign`,
    registerSticker: (packId: string) => `/admin/stickers/packs/${packId}/stickers`,
    sticker: (stickerId: string) => `/admin/stickers/stickers/${stickerId}`,
  },

  // ─── PMO (project management office) ──────────────────────────────────
  // Gated by NEXT_PUBLIC_PMO_ENABLED on the frontend and PMO_ENABLED on
  // the backend; routes 404 when the flag is off.
  pmo: {
    lists: {
      list: (slug: string) => `/projects/${slug}/task-lists`,
      create: (slug: string) => `/projects/${slug}/task-lists`,
      reorder: (slug: string) => `/projects/${slug}/task-lists/reorder`,
      one: (slug: string, listId: string) => `/projects/${slug}/task-lists/${listId}`,
      archive: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/archive`,
      unarchive: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/unarchive`,
      reorderTabs: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/tabs/reorder`,
      createTab: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/tabs`,
      deleteTab: (slug: string, listId: string, tabId: string) =>
        `/projects/${slug}/task-lists/${listId}/tabs/${tabId}`,
      statuses: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/statuses`,
    },
    tasks: {
      list: (
        slug: string,
        listId: string,
        filters: {
          statusId?: string;
          assigneeId?: string;
          q?: string;
          includeArchived?: boolean;
        } = {},
      ) => {
        const params = new URLSearchParams();
        if (filters.statusId) params.set('statusId', filters.statusId);
        if (filters.assigneeId) params.set('assigneeId', filters.assigneeId);
        if (filters.q) params.set('q', filters.q);
        if (filters.includeArchived) params.set('includeArchived', 'true');
        const qs = params.toString();
        return `/projects/${slug}/task-lists/${listId}/tasks${qs ? `?${qs}` : ''}`;
      },
      create: (slug: string, listId: string) =>
        `/projects/${slug}/task-lists/${listId}/tasks`,
      one: (slug: string, taskId: string) => `/projects/${slug}/tasks/${taskId}`,
      byKey: (slug: string, key: string) =>
        `/projects/${slug}/tasks/key/${encodeURIComponent(key)}`,
      move: (slug: string, taskId: string) => `/projects/${slug}/tasks/${taskId}/position`,
      archive: (slug: string, taskId: string) => `/projects/${slug}/tasks/${taskId}/archive`,
      unarchive: (slug: string, taskId: string) =>
        `/projects/${slug}/tasks/${taskId}/unarchive`,
    },
    /// Reuses the chat module's members endpoint for the assignee picker.
    /// Returns the same {id, name, avatarUrl} shape we need.
    members: (slug: string, q?: string) =>
      `/projects/${slug}/chat/members${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    /// Mention search for the description / comment composer @-popover.
    /// `kind=user` (project members) | `kind=task` (project tasks).
    mentionSearch: (slug: string, kind: 'user' | 'task', q?: string) => {
      const params = new URLSearchParams({ kind });
      if (q) params.set('q', q);
      return `/projects/${slug}/pmo/mention-search?${params.toString()}`;
    },
    comments: {
      list: (slug: string, taskId: string, page = 1, pageSize = 50) =>
        `/projects/${slug}/tasks/${taskId}/comments?page=${page}&pageSize=${pageSize}`,
      create: (slug: string, taskId: string) =>
        `/projects/${slug}/tasks/${taskId}/comments`,
      update: (slug: string, commentId: string) =>
        `/projects/${slug}/task-comments/${commentId}`,
      remove: (slug: string, commentId: string) =>
        `/projects/${slug}/task-comments/${commentId}`,
    },
    activity: (slug: string, taskId: string) =>
      `/projects/${slug}/tasks/${taskId}/activity`,
    gantt: (slug: string, listId: string) =>
      `/projects/${slug}/task-lists/${listId}/gantt`,
    overview: (slug: string, listId: string) =>
      `/projects/${slug}/task-lists/${listId}/overview`,
    addDependency: (slug: string, fromTaskId: string) =>
      `/projects/${slug}/tasks/${fromTaskId}/dependencies`,
    removeDependency: (slug: string, fromTaskId: string, depId: string) =>
      `/projects/${slug}/tasks/${fromTaskId}/dependencies/${depId}`,
    team: (slug: string) => `/projects/${slug}/pmo/team`,
    files: {
      list: (slug: string, folderId?: string) =>
        `/projects/${slug}/files${folderId ? `?folderId=${folderId}` : ''}`,
      presign: (slug: string) => `/projects/${slug}/files/presign`,
      register: (slug: string) => `/projects/${slug}/files`,
      createFolder: (slug: string) => `/projects/${slug}/files/folder`,
      update: (slug: string, fileId: string) => `/projects/${slug}/files/${fileId}`,
      remove: (slug: string, fileId: string, force?: boolean) =>
        `/projects/${slug}/files/${fileId}${force ? '?force=1' : ''}`,
    },
    notes: {
      list: (slug: string) => `/projects/${slug}/notes`,
      create: (slug: string) => `/projects/${slug}/notes`,
      one: (slug: string, noteId: string) => `/projects/${slug}/notes/${noteId}`,
      update: (slug: string, noteId: string) => `/projects/${slug}/notes/${noteId}`,
      remove: (slug: string, noteId: string) => `/projects/${slug}/notes/${noteId}`,
      yjsToken: (slug: string, noteId: string) => `/projects/${slug}/notes/${noteId}/yjs-token`,
    },
    whiteboards: {
      list: (slug: string) => `/projects/${slug}/whiteboards`,
      create: (slug: string) => `/projects/${slug}/whiteboards`,
      one: (slug: string, wbId: string) => `/projects/${slug}/whiteboards/${wbId}`,
      update: (slug: string, wbId: string) => `/projects/${slug}/whiteboards/${wbId}`,
      remove: (slug: string, wbId: string) => `/projects/${slug}/whiteboards/${wbId}`,
      yjsToken: (slug: string, wbId: string) => `/projects/${slug}/whiteboards/${wbId}/yjs-token`,
      exportMgm: (slug: string, wbId: string) => `/projects/${slug}/whiteboards/${wbId}/export`,
      thumbnailPresign: (slug: string, wbId: string) =>
        `/projects/${slug}/whiteboards/${wbId}/thumbnail/presign`,
    },
  },

  // ─── Voice (Phase 0: stubs only; populated in Phase 1+) ────────────────
  // Per-project voice channels live under /projects/:slug/voice/*; the
  // workspace lobby lives under /voice/lobby/*. Both surfaces share the
  // same join/leave/moderation routes under /voice/channels/:id/*.
  voice: {
    channels: (slugOrId: string) => `/projects/${slugOrId}/voice/channels`,
    channel: (slugOrId: string, channelId: string) =>
      `/projects/${slugOrId}/voice/channels/${channelId}`,
    lobbyChannels: () => '/voice/lobby/channels',
    lobbyChannel: (channelId: string) => `/voice/lobby/channels/${channelId}`,
    join: (channelId: string) => `/voice/channels/${channelId}/join`,
    leave: (channelId: string) => `/voice/channels/${channelId}/leave`,
    /** GET — resolve the paired ChatChannel id for a voice channel's text thread. */
    thread: (channelId: string) => `/voice/channels/${channelId}/thread`,
    moderateMute: (channelId: string) => `/voice/channels/${channelId}/moderate/mute`,
    moderateKick: (channelId: string) => `/voice/channels/${channelId}/moderate/kick`,
    moderateMove: (channelId: string) => `/voice/channels/${channelId}/moderate/move`,
    /** Phase 8 — stage channel actions. */
    handRaise: (channelId: string) => `/voice/channels/${channelId}/hand/raise`,
    handLower: (channelId: string) => `/voice/channels/${channelId}/hand/lower`,
    handQueue: (channelId: string) => `/voice/channels/${channelId}/hand/queue`,
    stagePromote: (channelId: string) => `/voice/channels/${channelId}/stage/promote`,
    stageDemote: (channelId: string) => `/voice/channels/${channelId}/stage/demote`,
    preferences: () => '/voice/me/preferences',
    soundboardClips: () => '/voice/soundboard/clips',
    soundboardClip: (id: string) => `/voice/soundboard/clips/${id}`,
    soundboardPresign: () => '/voice/soundboard/clips/presign',
    recordingStart: (channelId: string) => `/voice/channels/${channelId}/recording/start`,
    recordingStop: (channelId: string) => `/voice/channels/${channelId}/recording/stop`,
    recordings: (channelId: string) => `/voice/channels/${channelId}/recordings`,
    recordingDownload: (recordingId: string) => `/voice/recordings/${recordingId}/download`,
  },
};

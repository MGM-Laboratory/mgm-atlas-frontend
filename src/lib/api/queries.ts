// Centralized React Query keys + typed query/mutation helpers used by client
// components. Server components fetch via lib/api/server.ts directly.

import type {
  CollaborationRole,
  ContributionRequest,
  DashboardPayload,
  DiscoveryPayload,
  NotificationItem,
  Paginated,
  ProjectCard,
  ProjectDetail,
  SessionUser,
  Tag,
  UserSummary,
} from '@/lib/types';

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  notifications: (page: number) => ['notifications', page] as const,
  unreadCount: ['notifications', 'unread'] as const,
  discovery: ['discovery'] as const,
  projects: (filters: Record<string, unknown>) => ['projects', filters] as const,
  project: (slug: string) => ['project', slug] as const,
  projectRequests: (slug: string) => ['project', slug, 'requests'] as const,
  myRequests: ['contributions', 'mine'] as const,
  bookmarks: ['bookmarks'] as const,
  tags: ['tags'] as const,
  tagsGrouped: ['tags', 'grouped'] as const,
  collaborationRoles: ['admin', 'collaboration-roles'] as const,
  users: (search?: string) => ['users', search ?? ''] as const,
  featured: ['featured'] as const,
  chat: {
    myProjects: ['chat', 'me', 'projects'] as const,
    channels: (projectSlugOrId: string) => ['chat', 'channels', projectSlugOrId] as const,
    messages: (channelId: string) => ['chat', 'messages', channelId] as const,
    pins: (channelId: string) => ['chat', 'pins', channelId] as const,
    channelState: (channelId: string) => ['chat', 'channel-state', channelId] as const,
  },
  pmo: {
    lists: (slug: string) => ['pmo', 'lists', slug] as const,
    list: (slug: string, listId: string) => ['pmo', 'list', slug, listId] as const,
    tasks: (slug: string, listId: string, filters?: Record<string, unknown>) =>
      ['pmo', 'tasks', slug, listId, filters ?? {}] as const,
    task: (slug: string, taskId: string) => ['pmo', 'task', slug, taskId] as const,
    taskByKey: (slug: string, key: string) => ['pmo', 'task-by-key', slug, key] as const,
    members: (slug: string, q?: string) => ['pmo', 'members', slug, q ?? ''] as const,
    comments: (slug: string, taskId: string) => ['pmo', 'comments', slug, taskId] as const,
    activity: (slug: string, taskId: string) => ['pmo', 'activity', slug, taskId] as const,
    mentionSearch: (slug: string, kind: 'user' | 'task', q: string) =>
      ['pmo', 'mention-search', slug, kind, q] as const,
    gantt: (slug: string, listId: string) => ['pmo', 'gantt', slug, listId] as const,
    team: (slug: string) => ['pmo', 'team', slug] as const,
    files: (slug: string, folderId: string | null) =>
      ['pmo', 'files', slug, folderId ?? 'root'] as const,
    notes: (slug: string) => ['pmo', 'notes', slug] as const,
    note: (slug: string, noteId: string) => ['pmo', 'note', slug, noteId] as const,
    whiteboards: (slug: string) => ['pmo', 'whiteboards', slug] as const,
    whiteboard: (slug: string, wbId: string) => ['pmo', 'whiteboard', slug, wbId] as const,
  },
} as const;

export type ProjectListFilters = {
  q?: string;
  phase?: string[];
  tagIds?: string[];
  recruitingFor?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  archived?: boolean;
  bookmarkedOnly?: boolean;
};

export type {
  CollaborationRole,
  ContributionRequest,
  DashboardPayload,
  DiscoveryPayload,
  NotificationItem,
  Paginated,
  ProjectCard,
  ProjectDetail,
  SessionUser,
  Tag,
  UserSummary,
};

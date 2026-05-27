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

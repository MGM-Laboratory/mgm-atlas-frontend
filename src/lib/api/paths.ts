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

  collaborationRoles: () => '/admin/collaboration-roles',
  collaborationRole: (id: string) => `/admin/collaboration-roles/${id}`,

  health: () => '/health',
};

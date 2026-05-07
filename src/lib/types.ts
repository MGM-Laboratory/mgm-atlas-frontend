// Shared types mirroring the backend Prisma schema. Update both when the
// schema changes — they are not auto-generated.

export type ProjectPhase =
  | 'IDEA'
  | 'PLANNING'
  | 'IN_DEVELOPMENT'
  | 'IN_REVIEW'
  | 'SHIPPED'
  | 'ARCHIVED';

export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';

export type ProjectRole = 'PROJECT_MANAGER' | 'CONTRIBUTOR';

export type MediaType = 'IMAGE' | 'VIDEO';

export type ContributionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

export type NotificationType =
  | 'CONTRIBUTION_REQUEST_SUBMITTED'
  | 'CONTRIBUTION_REQUEST_APPROVED'
  | 'CONTRIBUTION_REQUEST_REJECTED'
  | 'PROJECT_INVITED'
  | 'PROJECT_ROLE_CHANGED'
  | 'PROJECT_REMOVED';

export interface SessionUser {
  id: string;
  keycloakId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  slug: string;
}

export interface CollaborationRole {
  id: string;
  name: string;
  order: number;
}

export interface UserSummary {
  id: string;
  name: string;
  email?: string;
  avatarUrl: string | null;
}

export interface ProjectMedia {
  id: string;
  url: string;
  type: MediaType;
  order: number;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
}

export interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  thumbnailType: MediaType | null;
  phase: ProjectPhase;
  visibility: ProjectVisibility;
  collaborationRoles: string[];
  archivedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  tags: Tag[];
  previewMedia: ProjectMedia[];
  memberCount: number;
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  title: string | null;
  joinedAt: string;
  user: UserSummary;
}

export interface ProjectDetailViewer {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: unknown; // Tiptap JSON document
  thumbnailUrl: string | null;
  thumbnailType: MediaType | null;
  techStack: string[];
  phase: ProjectPhase;
  visibility: ProjectVisibility;
  collaborationRoles: string[];
  archivedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  tags: Tag[];
  media: ProjectMedia[];
  managers: UserSummary[];
  memberCount: number;
  access: { level: 'admin' | 'manager' | 'contributor' | 'viewer'; isInsider: boolean; isManager: boolean };
}

export interface ProjectDetailInsider extends ProjectDetailViewer {
  internalLinks: { pmTool?: string; repository?: string; staging?: string; designs?: string } | null;
  members: ProjectMember[];
  pendingRequestCount?: number;
  ownerEmail: string;
}

export type ProjectDetail = ProjectDetailViewer | ProjectDetailInsider;

export function isInsider(p: ProjectDetail): p is ProjectDetailInsider {
  return p.access.isInsider;
}

export interface ContributionRequest {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  message: string;
  status: ContributionStatus;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  user?: UserSummary;
  project?: {
    id: string;
    slug: string;
    title: string;
    shortDescription?: string;
    thumbnailUrl?: string | null;
    thumbnailType?: MediaType | null;
  };
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  invitedUserId: string;
  invitedById: string;
  role: ProjectRole;
  title: string | null;
  status: InviteStatus;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DiscoveryPayload {
  hero: ProjectCard[];
  myProjects: { managed: ProjectCard[]; contributing: ProjectCard[] };
  pendingRequests: { id: string; role: string; createdAt: string; project: ProjectCard }[];
  rows: { key: string; label: string; items: ProjectCard[] }[];
  tags: Tag[];
}

export interface DashboardPayload {
  managed: Array<Pick<ProjectCard, 'id' | 'slug' | 'title' | 'shortDescription' | 'phase' | 'visibility' | 'thumbnailUrl' | 'thumbnailType'> & { archivedAt: string | null }>;
  contributing: Array<Pick<ProjectCard, 'id' | 'slug' | 'title' | 'shortDescription' | 'phase' | 'visibility' | 'thumbnailUrl' | 'thumbnailType'> & { archivedAt: string | null }>;
  pendingRequests: { id: string; role: string; message: string; createdAt: string; project: Pick<ProjectCard, 'id' | 'slug' | 'title' | 'shortDescription' | 'thumbnailUrl' | 'thumbnailType'> }[];
  bookmarks: Pick<ProjectCard, 'id' | 'slug' | 'title' | 'shortDescription' | 'phase' | 'thumbnailUrl' | 'thumbnailType'>[];
}

export const PROJECT_PHASE_LABEL: Record<ProjectPhase, string> = {
  IDEA: 'Idea',
  PLANNING: 'Planning',
  IN_DEVELOPMENT: 'In development',
  IN_REVIEW: 'In review',
  SHIPPED: 'Shipped',
  ARCHIVED: 'Archived',
};

export const BRAND_FOR_PHASE: Record<ProjectPhase, 'blue' | 'yellow' | 'red' | 'green' | 'neutral'> = {
  IDEA: 'neutral',
  PLANNING: 'yellow',
  IN_DEVELOPMENT: 'blue',
  IN_REVIEW: 'yellow',
  SHIPPED: 'green',
  ARCHIVED: 'neutral',
};

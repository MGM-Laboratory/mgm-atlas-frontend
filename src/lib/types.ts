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
  | 'PROJECT_REMOVED'
  | 'CHAT_MENTION'
  | 'TASK_ASSIGNED'
  | 'TASK_MENTIONED'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'
  | 'TASK_COMMENT_REPLY'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DEPENDENCY_BLOCKED'
  | 'NOTE_MENTIONED'
  | 'WHITEBOARD_MENTIONED'
  | 'VOICE_PARTICIPANT_JOINED'
  | 'VOICE_MENTIONED';

/**
 * Per-user notification preferences (Phase 4). Mirrors the backend's
 * `NotificationPreference` Prisma model 1:1 — every boolean here maps
 * to a column the controller's `PATCH /notifications/preferences`
 * route accepts.
 */
export interface NotificationPreference {
  id: string;
  userId: string;
  pushEnabled: boolean;
  contributionRequestEnabled: boolean;
  projectInvitedEnabled: boolean;
  projectRoleChangedEnabled: boolean;
  projectRemovedEnabled: boolean;
  chatMentionEnabled: boolean;
  taskAssignedEnabled: boolean;
  taskMentionedEnabled: boolean;
  taskDueSoonEnabled: boolean;
  taskOverdueEnabled: boolean;
  taskCommentReplyEnabled: boolean;
  taskStatusChangedEnabled: boolean;
  taskDependencyBlockedEnabled: boolean;
  noteMentionedEnabled: boolean;
  whiteboardMentionedEnabled: boolean;
  voiceParticipantJoinedEnabled: boolean;
  voiceMentionedEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NotificationPreferenceKey =
  keyof Pick<
    NotificationPreference,
    | 'pushEnabled'
    | 'contributionRequestEnabled'
    | 'projectInvitedEnabled'
    | 'projectRoleChangedEnabled'
    | 'projectRemovedEnabled'
    | 'chatMentionEnabled'
    | 'taskAssignedEnabled'
    | 'taskMentionedEnabled'
    | 'taskDueSoonEnabled'
    | 'taskOverdueEnabled'
    | 'taskCommentReplyEnabled'
    | 'taskStatusChangedEnabled'
    | 'taskDependencyBlockedEnabled'
    | 'noteMentionedEnabled'
    | 'whiteboardMentionedEnabled'
    | 'voiceParticipantJoinedEnabled'
    | 'voiceMentionedEnabled'
  >;

export interface PushSubscriptionDevice {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export type ChatMessageKind =
  | 'TEXT'
  | 'SYSTEM_CHANNEL_CREATED'
  | 'SYSTEM_CHANNEL_RENAMED'
  | 'SYSTEM_PINNED';

export type ChatAttachmentKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

export type ChatDeleteActor = 'SELF' | 'MODERATOR';

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
  bookmarked?: boolean;
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
  /// Top open PMO tasks assigned to me, soonest-due first. Absent/empty when PMO is off.
  myOpenTasks?: MyOpenTask[];
}

export interface MyOpenTask {
  id: string;
  key: string;
  title: string;
  dueDate: string | null;
  priority: TaskPriority;
  status: { name: string; color: string; category: TaskStatusCategory };
  taskList: { id: string; name: string };
  project: { slug: string; title: string };
}

/// Overview-tab aggregate stats (GET …/task-lists/:listId/overview).
export interface ListOverview {
  byStatus: { statusId: string; name: string; color: string; category: TaskStatusCategory; count: number }[];
  dueToday: number;
  dueThisWeek: number;
  overdue: number;
  totalOpen: number;
  workload: { userId: string; name: string; avatarUrl: string | null; count: number }[];
  recentActivity: {
    id: string;
    kind: string;
    payload: unknown;
    createdAt: string;
    taskId: string;
    actor: { id: string; name: string; avatarUrl: string | null } | null;
  }[];
}

// ─── Chat ──────────────────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  /** null = workspace-global channel (visible to every authenticated user). */
  projectId: string | null;
  name: string;
  slug: string;
  topic: string | null;
  isGeneral: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  kind: ChatAttachmentKind;
  url: string;
  s3Key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  posterUrl: string | null;
  createdAt: string;
}

export interface ChatReactionGroup {
  emoji: string;
  count: number;
  users: { id: string; name: string }[];
}

export interface ChatReplyPreview {
  id: string;
  preview: string;
  isDeleted: boolean;
  author: UserSummary;
}

export interface ChatForwardOrigin {
  id: string;
  channelId: string;
  author: { id: string; name: string };
}

export interface ChatMessageMetadata {
  linkPreviews?: ChatLinkPreview[];
}

export interface ChatMessage {
  id: string;
  channelId: string;
  kind: ChatMessageKind;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedActor: ChatDeleteActor | null;
  deletedBy: { id: string; name: string } | null;
  author: UserSummary;
  markdown: string;
  metadata: ChatMessageMetadata | null;
  attachments: ChatAttachment[];
  reactions: ChatReactionGroup[];
  replyTo: ChatReplyPreview | null;
  forwardedFrom: ChatForwardOrigin | null;
  /** True if the message has an active pin in its channel. */
  isPinned?: boolean;
  /** Optional manager-supplied context note attached at pin time. */
  pinNote?: string | null;
  /** Echoed back from the request so optimistic UI can reconcile. */
  clientMessageId?: string;
}

export interface ChatMessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export interface ChatChannelState {
  /** Last message the current user has read in this channel, if any. */
  lastReadMessageId: string | null;
  /** Timestamp the user last read the channel, if any. */
  lastReadAt: string | null;
}

export interface ChatProjectOverviewChannel {
  id: string;
  name: string;
  slug: string;
  isGeneral: boolean;
  unread: number;
  updatedAt: string;
}

export interface ChatProjectOverview {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  updatedAt: string;
  channels: ChatProjectOverviewChannel[];
  unread: number;
}

export interface ChatWorkspaceOverview {
  channels: ChatProjectOverviewChannel[];
  unread: number;
}

export interface ChatOverviewPayload {
  projects: ChatProjectOverview[];
  /** Workspace-global channels. Optional: older backends omit it. */
  workspace?: ChatWorkspaceOverview;
}

export interface ChatLinkPreview {
  url: string;
  kind: 'link' | 'video' | 'gif';
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  embedHtml?: string | null;
  cached?: boolean;
}

export interface ChatGif {
  id: string;
  title: string;
  previewUrl: string;
  gifUrl: string;
  mp4Url: string | null;
  width: number;
  height: number;
}

export interface ChatGifSearchResult {
  provider: 'tenor' | 'giphy';
  results: ChatGif[];
  next: string | null;
}

export interface ChatAttachmentPresign {
  uploadUrl: string;
  expiresIn: number;
  s3Key: string;
  publicUrl: string;
  kind: ChatAttachmentKind;
  contentType: string;
}

export interface ChatMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** null for workspace-global member search (no project role context). */
  role: ProjectRole | null;
  title: string | null;
}

export interface ChatSearchHit {
  id: string;
  channelId: string;
  channelName: string;
  /** null for hits in workspace-global channels. */
  projectId: string | null;
  projectSlug: string | null;
  projectTitle: string | null;
  authorId: string;
  authorName: string;
  /** Snippet with `<mark>` wrappers — sanitised by the renderer. */
  snippet: string;
  rank: number;
  createdAt: string;
}

export interface ChatSearchResponse {
  scope: 'channel' | 'project' | 'global';
  query: string;
  hits: ChatSearchHit[];
  nextCursor: string | null;
}

export interface Sticker {
  id: string;
  name: string;
  keywords: string[];
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
}

export interface StickerPack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stickers: Sticker[];
}

export interface AdminStickerPack extends StickerPack {
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { stickers: number };
}

export interface StickerPresignResponse {
  uploadUrl: string;
  expiresIn: number;
  s3Key: string;
  publicUrl: string;
  contentType: string;
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

// ─── PMO (project management office) ────────────────────────────────────────

export type PmoBrandColor = 'blue' | 'yellow' | 'red' | 'green' | 'neutral';

export type TaskStatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskListTabKind =
  | 'OVERVIEW'
  | 'LIST'
  | 'KANBAN'
  | 'GANTT'
  | 'TEAM'
  | 'FILES'
  | 'NOTES'
  | 'WHITEBOARDS'
  | 'EMBED';

export interface TaskStatus {
  id: string;
  taskListId: string;
  name: string;
  color: string;
  category: TaskStatusCategory;
  order: number;
  isDefault: boolean;
}

export interface TaskListTab {
  id: string;
  taskListId: string;
  kind: TaskListTabKind;
  label: string | null;
  iconName: string | null;
  url: string | null;
  embedPreset: string | null;
  order: number;
  hidden: boolean;
  createdAt: string;
}

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  iconName: string;
  iconColor: PmoBrandColor;
  order: number;
  contributorsCanCreateTasks: boolean;
  projectKey: string | null;
  taskCounter: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  statuses: TaskStatus[];
  tabs: TaskListTab[];
  _count?: { tasks: number };
}

/** Default left-to-right order of the built-in tabs as the backend seeds them. */
export const TASK_LIST_TAB_KIND_ORDER: TaskListTabKind[] = [
  'OVERVIEW',
  'LIST',
  'KANBAN',
  'GANTT',
  'TEAM',
  'FILES',
  'NOTES',
  'WHITEBOARDS',
];

export const TASK_LIST_TAB_LABEL: Record<TaskListTabKind, string> = {
  OVERVIEW: 'Overview',
  LIST: 'List',
  KANBAN: 'Kanban',
  GANTT: 'Timeline',
  TEAM: 'Team',
  FILES: 'Files',
  NOTES: 'Notes',
  WHITEBOARDS: 'Whiteboards',
  EMBED: 'Embed',
};

/**
 * URL path segment per built-in tab kind, appended to
 * `/projects/[slug]/lists/[listId]`. EMBED tabs use their own id.
 */
export const TASK_LIST_TAB_PATH: Record<Exclude<TaskListTabKind, 'EMBED'>, string> = {
  OVERVIEW: '',
  LIST: '/list',
  KANBAN: '/kanban',
  GANTT: '/timeline',
  TEAM: '/team',
  FILES: '/files',
  NOTES: '/notes',
  WHITEBOARDS: '/whiteboards',
};

/**
 * Which built-in tab kinds are wired up in the frontend right now. Tabs not
 * in this set still render in the navbar (so users can see the future
 * shape) but are disabled with a tooltip until their phase ships.
 *
 * Update this set as each phase lands.
 */
export const IMPLEMENTED_TAB_KINDS: ReadonlySet<TaskListTabKind> = new Set<TaskListTabKind>([
  'OVERVIEW',
  'LIST',
  'KANBAN',
  'GANTT',
  'TEAM',
  'FILES',
  'NOTES',
  'WHITEBOARDS',
]);

export interface WhiteboardListItem {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full whiteboard incl. the Excalidraw scene projection (preview/export). */
export interface Whiteboard extends WhiteboardListItem {
  yDocKey: string;
  sceneSnapshot: unknown;
  deletedAt: string | null;
}

/** A node in the project Notes tree (metadata only — content lives in Yjs). */
export interface ProjectNoteTreeItem {
  id: string;
  projectId: string;
  parentNoteId: string | null;
  title: string;
  iconName: string | null;
  order: number;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full note including the BlockNote JSON projection (SSR/preview/fallback). */
export interface ProjectNote extends ProjectNoteTreeItem {
  yDocKey: string;
  contentSnapshot: unknown;
  deletedAt: string | null;
}

/** Response of GET /projects/:slug/notes/:noteId/yjs-token. */
export interface YjsTokenResponse {
  token: string;
  docKey: string;
  wsUrl: string;
}

export interface ProjectFileUploader {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** A node in the project Files tree — either a folder or an uploaded file. */
export interface ProjectFile {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
  isFolder: boolean;
  /// Null for folders.
  url: string | null;
  s3Key: string | null;
  mime: string | null;
  bytes: number | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  uploadedBy: ProjectFileUploader | null;
}

export interface ProjectFilesResponse {
  /// The folder being listed, or null for the project root.
  folderId: string | null;
  /// Root-to-current ancestor chain (excludes the root itself).
  breadcrumb: { id: string; name: string }[];
  items: ProjectFile[];
}

export interface TaskAssigneeUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: string;
  user: TaskAssigneeUser;
}

export interface Task {
  id: string;
  taskListId: string;
  projectId: string;
  key: string;
  title: string;
  /// Tiptap JSON document.
  description: Record<string, unknown>;
  statusId: string;
  status: TaskStatus;
  priority: TaskPriority;
  storyPoints: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  /// Stringified Decimal from Prisma. Compare via Number().
  positionInStatus: string;
  createdById: string;
  archivedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
}

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  NONE: 'No priority',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TASK_PRIORITY_ORDER: TaskPriority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// ─── Task comments + activity (Phase 3) ─────────────────────────────────────

export interface TaskComment {
  id: string;
  taskId: string;
  /// GFM markdown source. May be the tombstone "_[comment removed]_" if deleted.
  markdown: string;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  author: TaskAssigneeUser;
}

export interface PaginatedComments {
  items: TaskComment[];
  total: number;
  page: number;
  pageSize: number;
}

export type TaskActivityKind =
  | 'CREATED'
  | 'RENAMED'
  | 'DESCRIPTION_EDITED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'DUE_DATE_SET'
  | 'DUE_DATE_CLEARED'
  | 'START_DATE_SET'
  | 'DEPENDENCY_ADDED'
  | 'DEPENDENCY_REMOVED'
  | 'COMMENT_ADDED'
  | 'ATTACHMENT_ADDED'
  | 'ARCHIVED'
  | 'UNARCHIVED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'MENTIONED';

export interface TaskActivity {
  id: string;
  kind: TaskActivityKind;
  /// Structured diff. Shape depends on `kind`; see backend
  /// task-activity.service for the writer.
  payload: Record<string, unknown>;
  createdAt: string;
  actor: TaskAssigneeUser | null;
}

export interface PaginatedActivity {
  items: TaskActivity[];
  total: number;
  page: number;
  pageSize: number;
}

export type TaskDependencyKind =
  | 'FINISH_TO_START'
  | 'START_TO_START'
  | 'FINISH_TO_FINISH'
  | 'START_TO_FINISH';

export interface GanttTaskRow {
  id: string;
  key: string;
  title: string;
  statusId: string;
  statusName: string;
  statusCategory: TaskStatusCategory;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignees: TaskAssigneeUser[];
}

export interface GanttDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  kind: TaskDependencyKind;
}

export interface GanttPayload {
  tasks: GanttTaskRow[];
  dependencies: GanttDependency[];
}

export type MentionSuggestionKind = 'user' | 'task';

export interface MentionSuggestion {
  kind: MentionSuggestionKind;
  id: string;
  label: string;
  subtitle?: string;
  avatarUrl?: string | null;
  iconName?: string | null;
  iconColor?: string | null;
}

// ─── Team (Phase 6) ─────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
  };
  role: ProjectRole;
  /// Free-form collaboration role title (e.g. "Frontend Engineer").
  title: string | null;
  joinedAt: string;
  /// Project-wide count of non-deleted, non-archived assigned tasks.
  taskCount: number;
  isOwner: boolean;
}

export interface TeamPayload {
  managers: TeamMember[];
  contributors: TeamMember[];
}

/// A runtime feature flag (Phase 5). `key` is dotted/snake, e.g. `ui.maintenance_banner`.
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/// The public evaluated flag map served at GET /feature-flags.
export type FeatureFlagMap = Record<string, boolean>;

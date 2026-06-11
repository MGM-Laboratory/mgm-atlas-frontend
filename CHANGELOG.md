# Changelog

All notable changes to the MGM Atlas web app are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Pre-1.0, minor versions may contain breaking changes.

## [Unreleased]

## [0.1.0] - 2026-06-11

First tracked release — the app live at [atlas.labmgm.org](https://atlas.labmgm.org).

### Added

- **Discovery & portfolio** — Netflix-style dashboard with featured hero and
  curated rows; browse with search, tag filters, phases, and recruiting
  status; project detail pages with media heroes and team rosters; 5-step
  creation wizard with drag-and-drop S3 gallery uploads.
- **Auth** — Keycloak SSO hand-off with return-to-URL deep-link redirect;
  client-side session via the backend's opaque session ID.
- **Chat UI** — workspace-global `#general` + per-project channels; replies,
  reactions, pins, forwarding, GIF picker, stickers, emoji picker, link
  previews, file attachments, typing indicators, unread badges, full-text
  search; Tiptap-powered composer.
- **PMO** *(behind `NEXT_PUBLIC_PMO_ENABLED`)* — task lists with custom
  statuses; drag-and-drop kanban; Gantt timeline; task detail modal route;
  collaborative notes (BlockNote + Yjs) and whiteboards (Excalidraw + Yjs)
  with live presence; file manager; website embeds (Figma, Docs, YouTube, …);
  global <kbd>Cmd</kbd>+<kbd>Z</kbd> server-backed undo; revision history
  drawer.
- **Voice UI** *(behind `NEXT_PUBLIC_VOICE_ENABLED`)* — voice/video rooms
  with screen share up to 1080p60; workspace Voice Lobby; push-to-talk and
  voice-activity modes; per-participant volume; deafen; soundboard; stage
  channels with hand-raise; moderation menus; recordings; persistent device
  preferences and rebindable shortcuts; connection-quality + ping indicators.
- **Notifications** — header bell with live unread count; paginated inbox;
  per-type preference panel; PWA service worker with web push and inline
  quick-reply.
- **Personal space** — `/me` dashboard (managing / contributing / pending /
  saved) and bookmarks.
- **Admin console** — tag manager, featured projects, collaboration roles,
  user management, sticker packs.
- **Design system** — locked MGM identity: brand tokens, type ramp, radii,
  motion tokens, geometric pattern components, Lucide stroke icons.

[Unreleased]: https://github.com/MGM-Laboratory/mgm-atlas-frontend/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MGM-Laboratory/mgm-atlas-frontend/releases/tag/v0.1.0

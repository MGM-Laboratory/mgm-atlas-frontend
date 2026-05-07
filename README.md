# mgm-atlas-frontend

Next.js 15 (App Router) frontend for **MGM Atlas** — the project portfolio dashboard for MGM Laboratory.

Production: `https://atlas.labmgm.org`. Talks to the backend at `https://atlas.labmgm.org/api/v1`.

## Stack

| Concern              | Choice                                                                |
|----------------------|-----------------------------------------------------------------------|
| Framework            | Next.js 15 (App Router, RSC, standalone output)                        |
| Language             | TypeScript 5                                                           |
| Styling              | Tailwind CSS 3 + the MGM Laboratory design tokens                      |
| Auth                 | Auth.js (NextAuth v5) with Keycloak OIDC, refresh-token rotation       |
| Data                 | TanStack Query 5 (client) + RSC fetching (server) via shared API client |
| Forms / validation   | React Hook Form + Zod                                                  |
| Rich text            | Tiptap (`StarterKit` + Link / Image / Placeholder / CodeBlockLowlight) |
| Animation            | Framer Motion (motion-restraint per design system)                     |
| Primitives           | Radix UI (re-skinned via `class-variance-authority`)                   |
| Icons                | Lucide (stroke-only, 2.25 stroke width)                                |
| Fonts                | Bricolage Grotesque (display) + Geist (sans/mono) via `next/font`      |
| Container            | Multi-stage Alpine Dockerfile, Next standalone output, tini            |
| CI/CD                | GitHub Actions, two environments (`dev` → staging, `main` → prod)      |

## Quick start

```bash
pnpm install
cp .env.example .env       # fill real values
pnpm dev                   # http://localhost:3001
```

You'll need:

* The backend API reachable at `NEXT_PUBLIC_API_URL`
* A Keycloak realm `mgm` with a confidential client `atlas-web` whose redirect URI is `https://atlas.labmgm.org/api/auth/callback/keycloak` (and `http://localhost:3001/...` for dev)

## Project layout

```
src/
├─ app/
│  ├─ layout.tsx                     fonts, providers, metadata
│  ├─ providers.tsx                  React Query, Tooltip, Toast, Session
│  ├─ globals.css                    design tokens + Tiptap skin + motion guard
│  ├─ page.tsx                       redirect → /dashboard or /login
│  ├─ login/page.tsx                 Keycloak hand-off
│  ├─ health/page.tsx                public status reflecting API /health
│  ├─ api/auth/[...nextauth]/        Auth.js handlers
│  └─ (authenticated)/               every route under here requires a session
│     ├─ layout.tsx                  header + footer + RSC user fetch
│     ├─ dashboard/page.tsx          Netflix-style discovery
│     ├─ projects/page.tsx           browse + filter + paginate
│     ├─ projects/new/page.tsx       5-step creation wizard
│     ├─ projects/[slug]/page.tsx    detail (viewer + insider)
│     ├─ projects/[slug]/manage/     edit / requests / team / settings
│     ├─ me/page.tsx                 personal dashboard (managed/contrib/pending/saved)
│     ├─ notifications/page.tsx      paginated inbox
│     └─ admin/page.tsx              tags / featured / roles / users
├─ auth.ts                           Auth.js v5 config + token refresh
├─ middleware.ts                     redirect unauthenticated routes
├─ components/
│  ├─ brand/                         Wordmark, ShapeSignature, PatternCorner, PatternDado
│  ├─ ui/                            Button, Input, Card, Badge, Dialog, Tabs, Tooltip…
│  ├─ layout/                        Container, Header, Footer, NotificationBell, UserMenu
│  ├─ projects/                      ProjectCard (Netflix hover), Hero, ProjectRow, MediaHero…
│  ├─ projects/manage/               EditProjectForm, ContributionRequestsList, TeamPanel, DangerZone
│  ├─ projects/new/                  Stepper + Wizard
│  ├─ rich-text/                     Tiptap editor + toolbar
│  ├─ media/                         MediaUpload (S3 presigned PUT + reorder)
│  └─ admin/                         TagManager, UserManager, RoleManager, FeaturedManager
└─ lib/
   ├─ api/                           server.ts (RSC fetch with bearer), client.ts (browser fetch + S3 upload), paths.ts, error.ts
   ├─ types.ts                       types mirroring the backend
   └─ utils.ts                       cn(), initials, formatRelative, bytesHuman
```

## Auth flow

1. Anyone hitting a route under `(authenticated)` is intercepted by `middleware.ts`. If there is no session it redirects to `/login`.
2. `/login` calls `signIn('keycloak')`, which redirects to `iam.labmgm.org/realms/mgm`.
3. Keycloak comes back with an authorization code; Auth.js exchanges it for tokens and the session is established.
4. On every JWT refresh, `auth.ts` rotates the access token via the Keycloak refresh endpoint. If the refresh token is dead, the session is flagged `RefreshAccessTokenError` and middleware bounces the user back to `/login`.
5. Server fetches go through `lib/api/server.ts` which reads the session and attaches `Authorization: Bearer <access_token>`. Client fetches go through `lib/api/client.ts` which uses `getSession()` for the same purpose.

## Design system

The look-and-feel is locked to the **MGM Laboratory** visual system. The most important rules baked into this codebase:

* **One leading brand color per surface.** Every component picks blue / yellow / red / green deliberately; the four colors only appear together inside the geometric pattern.
* **Tokens, not literals.** `tailwind.config.ts` and `globals.css` are the source of truth for color, type, spacing, radii, motion. Don't hand-roll new values.
* **Stroke icons only.** Lucide at 2.25 stroke width.
* **Restrained motion.** All durations and easings come from the design tokens (`duration-120`/`200`/`320`/`520`/`800` × `ease-out-soft`/`spring`). `prefers-reduced-motion` neutralizes them.
* **Pattern as accent.** `<PatternCorner>` and `<PatternDado>` are signature flourishes — they live in corners and footer dadoes, never as a tiled wallpaper.

## Environment variables

| Var                                  | Notes                                                            |
|--------------------------------------|------------------------------------------------------------------|
| `NEXT_PUBLIC_APP_URL`                | Public app URL (also used as Auth.js trust host)                 |
| `NEXT_PUBLIC_API_URL`                | Backend base, e.g. `https://atlas.labmgm.org/api/v1`             |
| `NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL`   | Keycloak account self-service URL surfaced in the user menu     |
| `AUTH_SECRET`                        | Long random hex; signs the Auth.js JWT cookie                    |
| `AUTH_URL`                           | Same as `NEXT_PUBLIC_APP_URL`; required for Auth.js callback     |
| `AUTH_KEYCLOAK_ISSUER`               | `https://iam.labmgm.org/realms/mgm`                              |
| `AUTH_KEYCLOAK_ID`                   | Keycloak client id (`atlas-web`)                                 |
| `AUTH_KEYCLOAK_SECRET`               | Keycloak client secret                                           |

## Deploying

* Push to `dev` → `staging.yml` builds the image, tags `labmgm/atlas-frontend:staging-<sha>`, SSHes to staging and `docker compose up -d`.
* Push to `main` → `production.yml` builds + tags `:latest`, `:<sha>`, `:<timestamp>` and deploys to prod.
* The `NEXT_PUBLIC_*` env vars are baked into the image at build time via `--build-arg`. Server-only env vars (`AUTH_*`) come from `.env` written by the workflow on the host.

GitHub Actions secrets per environment:

| Secret                                | Purpose                                                |
|---------------------------------------|--------------------------------------------------------|
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`| Docker Hub push                                       |
| `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` | Deploy target                                       |
| `DEPLOY_PATH`                         | Directory on the host where compose lives             |
| `ENV_FILE`                            | Full contents of `.env`                                |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL` | Bake-time public envs |

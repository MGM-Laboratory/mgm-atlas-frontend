# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm 10.13.1** (Node ≥ 20.11). Dev server runs on port **3001**.

```bash
pnpm dev          # start dev server (http://localhost:3001)
pnpm build        # production build (Next standalone output)
pnpm start        # serve a built app on :3001
pnpm typecheck    # tsc --noEmit (run before pushing — CI gates on this)
pnpm lint         # next lint (CI also gates on this)
pnpm format       # prettier --write src/**/*.{ts,tsx,css}
```

CI (`.github/workflows/ci.yml`) only runs `pnpm typecheck` and `pnpm lint` on PRs — there is no test suite in this repo.

## Architecture

Next.js 15 App Router frontend for **MGM Atlas**, a project portfolio dashboard. It is a thin client over a separate backend at `NEXT_PUBLIC_API_URL` (default `https://atlas.labmgm.org/api/v1`).

### Auth — read this before touching anything session-related

**The README is stale.** It describes Auth.js v5 with Keycloak, server-side JWT rotation, and a `middleware.ts` that gates `(authenticated)` routes. That is **not** what the code does today. The actual flow:

1. `/login` builds a Keycloak OAuth URL client-side via `buildKeycloakAuthUrl()` in `src/lib/auth-client.ts` and redirects there.
2. Keycloak returns to `src/app/api/auth/callback/route.ts`, which exchanges the code for tokens, extracts identity claims from the ID token (falling back to `/userinfo`), and POSTs them to the **backend's** `/auth/login`. The backend returns a `sessionId` + user blob.
3. The route hands the session blob back to the SPA by redirecting to `/?session=<json>`. `src/lib/hooks/use-auth-callback.ts` parses it from the URL and calls `storeSession()` to put it in **localStorage** (keys: `atlas_session`, `atlas_tokens`).
4. Every API call sends `Authorization: Bearer <sessionId>` — the backend, not the frontend, validates sessions.
5. Route protection is **client-side only**: `src/app/(authenticated)/layout.tsx` reads `getStoredSession()` and `router.push('/login')` via `useEffect` if missing. `src/middleware.ts` is a no-op pass-through despite its name.

Consequences a future Claude must keep in mind:

- **There is no Auth.js / NextAuth.** Don't import from `next-auth` even though it's still in `package.json` — it's dead weight pending removal.
- **There are no httpOnly cookies.** Session lives in `localStorage`, accessible only to client code.
- **`src/lib/api/server.ts` is partially broken by design today (verified current).** It calls `getSessionId()` from `auth-client.ts`, which is gated on `typeof window !== 'undefined'` and therefore returns `null` whenever it runs on the server. Any RSC fetch through `api()` / `apiGet()` will go out unauthenticated and the backend will 401. Until a server-side session source exists (cookie, header forwarded from the client, etc.), RSC reads that need a user's session won't work.
- **Prefer client fetching (`@/lib/api/client` + TanStack Query)** for any data that needs the user's session until the server-side path is settled.

### Data layer

- `src/lib/api/client.ts` — browser fetch wrapper, pulls session from localStorage, throws `ApiError` (`src/lib/api/error.ts`) on non-2xx.
- `src/lib/api/server.ts` — RSC fetch wrapper with the caveat above. Uses `React.cache` for per-request dedupe via `apiGet`.
- `src/lib/api/paths.ts` — **single source of truth for every backend route**. Always add new endpoints here rather than inlining path strings.
- `src/lib/api/queries.ts` — centralized TanStack Query keys + the `ProjectListFilters` type. Use `queryKeys` for cache invalidation; don't ad-hoc query keys.
- `src/lib/types.ts` — types mirroring the backend; treat as authoritative for shapes received from the API.
- TanStack Query defaults (in `src/app/providers.tsx`): `staleTime: 30s`, no refetch-on-focus, no retries on 4xx, max 2 retries on 5xx, no retries on mutations.

### Routing

- Path alias `@/*` → `src/*`.
- Next's `experimental.typedRoutes` is **on** (`next.config.mjs`). Dynamic hrefs that the type-checker can't statically prove sometimes need `as never` (e.g., `<Link href={'/me' as never}>` in `user-menu.tsx`) — copy that pattern, don't fight it.
- Everything under `src/app/(authenticated)/` requires a session (enforced by that group's layout). Public routes: `/`, `/login`, `/health`.

### Design system — non-negotiable

Locked to the MGM Laboratory visual identity. Rules baked into the code:

- **Use design tokens, not literals.** `tailwind.config.ts` defines all colors (`brand.blue|yellow|red|green` + 50/ink variants), type ramps (`display-2xl`…`eyebrow`), radii (`sm|DEFAULT|lg|xl`), shadows (`1|2|3`), motion durations (`120|200|320|520|800`) and easings (`out-soft`, `in-out-soft`, `spring`). Never hand-roll hex values, custom `transition-duration`, or arbitrary shadows.
- **One leading brand color per surface.** A component picks blue / yellow / red / green deliberately. The only place all four appear together is inside the geometric pattern (`<PatternCorner>` / `<PatternDado>` in `components/brand/`).
- **Stroke icons only.** Lucide, `strokeWidth={2.25}`. No filled icon variants.
- **Restrained motion.** Compose durations + easings from the tokens above. `prefers-reduced-motion` is respected via `globals.css`.
- **Pattern as accent, not wallpaper.** `<PatternCorner>` lives in corners; `<PatternDado>` in footer dadoes. Never tile them.

### Tech choices worth knowing

- **Forms:** React Hook Form + Zod via `@hookform/resolvers`.
- **Primitives:** Radix UI re-skinned with `class-variance-authority`. Wrappers live in `src/components/ui/`; build new UI by composing these, not by reaching for Radix directly in feature code.
- **Rich text:** Tiptap (StarterKit + Link / Image / Placeholder / CodeBlockLowlight). Editor + toolbar live in `src/components/rich-text/`.
- **Media upload:** S3 presigned PUT. The flow is `presignMedia` → `uploadToPresigned` (in `client.ts`, raw XHR for progress) → `registerMedia`. See `src/components/media/`.
- **Fonts:** Loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables (`--font-bricolage`, `--font-geist`, `--font-geist-mono`). Note: the file uses `Inter` / `JetBrains_Mono` as the Geist stand-ins despite the variable names.

### Environment

`NEXT_PUBLIC_*` vars are **baked into the build** by the Dockerfile via `--build-arg`. Changing them requires a rebuild, not just a restart. Server-only vars (`KEYCLOAK_CLIENT_SECRET`, `AUTH_*`) come from the `.env` file on the deploy host. Copy `.env.example` for local dev.

Required for any auth-touching change to work locally:
- `NEXT_PUBLIC_KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, `NEXT_PUBLIC_APP_URL`, `KEYCLOAK_CLIENT_SECRET`, `NEXT_PUBLIC_API_URL`.

### Deploy

- `dev` branch → `.github/workflows/staging.yml` → staging.
- `main` branch → `.github/workflows/production.yml` → prod.
- Runtime is the multi-stage Alpine `Dockerfile` (Next standalone output, `tini` PID 1, healthcheck hits `/health`).

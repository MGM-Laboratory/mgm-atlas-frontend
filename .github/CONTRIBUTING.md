# Contributing to MGM Atlas — Frontend

Thanks for your interest in MGM Atlas! This page covers the web app. The
backend API has its own guide in
[mgm-atlas-backend](https://github.com/MGM-Laboratory/mgm-atlas-backend/blob/main/.github/CONTRIBUTING.md).

> [!IMPORTANT]
> **Code contributions are limited to active MGM Laboratory members.** MGM
> Atlas is proprietary, source-visible software under the
> [ESDPL v1.0](../LICENSE) — the code is public to read and learn from, but
> only lab members may submit changes. **Everyone** is welcome to open
> [issues](https://github.com/MGM-Laboratory/mgm-atlas-frontend/issues) and
> join [Discussions](https://github.com/MGM-Laboratory/mgm-atlas-frontend/discussions).
> Lab members get repository access via the lab coordinator.

## Ways to contribute

- 🐛 **Found a bug?** Open a [bug report](https://github.com/MGM-Laboratory/mgm-atlas-frontend/issues/new/choose) — screenshots welcome.
- 💡 **Have an idea?** Start a [Discussion](https://github.com/MGM-Laboratory/mgm-atlas-frontend/discussions) or file a feature request.
- 🔒 **Security problem?** Never open a public issue — see [SECURITY.md](SECURITY.md).
- 🔧 **Lab member shipping code?** Read on.

## Development setup

Prerequisites: Node ≥ 20.11, pnpm, and the
[backend](https://github.com/MGM-Laboratory/mgm-atlas-backend) running on `:3000`.

```bash
pnpm install
cp .env.example .env          # NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
pnpm dev                      # http://localhost:3001
```

Before pushing: `pnpm typecheck && pnpm lint` — CI gates on exactly these.

## Branch model

| Branch | Meaning |
|---|---|
| `main` | Production — every push builds the production image |
| `dev` | Staging / integration |
| `feat/<scope>` · `fix/<scope>` · `hotfix/<scope>` | Working branches |

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org). Real
examples from this repo's history:

```
feat: workspace-global chat channels + return-to-URL login redirect
fix(pmo): auto-recover notes + whiteboards from JSON projection
fix(pmo-notes): don't save empty doc before Yjs initial sync finishes
```

## Code style & frontend ground rules

- **Formatting** — Prettier with the Tailwind plugin (100-char lines, single
  quotes). Run `pnpm format`.
- **Design tokens, not literals** — colors, type ramp, radii, shadows,
  durations, easings come from `tailwind.config.ts`. See
  [docs/design-system.md](../docs/design-system.md) for the five laws
  (one leading brand color per surface, Lucide stroke 2.25, restrained
  motion, pattern as accent).
- **Compose `components/ui/` primitives** — don't reach for raw Radix in
  feature code.
- **API routes live in `src/lib/api/paths.ts`** — the single source of truth;
  never inline path strings. Query keys live in `queries.ts`.
- **Feature-flag safe** — every screen must behave with
  `NEXT_PUBLIC_PMO_ENABLED` / `NEXT_PUBLIC_VOICE_ENABLED` off.
- **No `next-auth` imports** — it's dead weight pending removal; session
  handling goes through `src/lib/auth-client.ts`.
- **No secrets or internal hostnames** in code, comments, or docs.

## Pull request process

1. Branch from `dev` (`feat/...`), or from `main` only for `hotfix/...`.
2. Open a PR using the template — **screenshots are required for any UI
   change**.
3. CI (typecheck + lint) must be green; at least one maintainer review.
4. Staging soaks on `dev`; maintainers promote `dev → main` for release.

### What reviewers check

- Token discipline (no literal hex/durations/shadows)
- Works with feature flags off; no `next-auth` imports
- States: loading, empty, error — not just the happy path
- Accessibility basics: focus order, labels, contrast on tinted surfaces
- Conventional PR title; screenshots for UI changes; docs updated if needed

## Questions?

Open a [Discussion](https://github.com/MGM-Laboratory/mgm-atlas-frontend/discussions)
or email [atlas@labmgm.org](mailto:atlas@labmgm.org).

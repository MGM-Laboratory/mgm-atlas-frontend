<!-- Title must follow Conventional Commits, e.g. `feat(chat): message threads` -->

## Summary

<!-- What does this PR do, and why? One or two sentences. -->

Closes #

## Type of change

- [ ] `feat` — new functionality
- [ ] `fix` / `hotfix` — bug fix
- [ ] `refactor` / `chore` — no behavior change
- [ ] `docs` — documentation only

## How was this tested?

<!-- Pages exercised, browsers checked, states covered (loading/empty/error). -->

- [ ] Verified on staging (for risky changes)

## Screenshots

<!-- REQUIRED for any UI change: before/after, light backgrounds, real data shapes. -->

## Checklist

- [ ] PR title follows Conventional Commits
- [ ] `pnpm typecheck` and `pnpm lint` pass locally
- [ ] **No secrets, internal hostnames, or infrastructure details** anywhere
- [ ] Design tokens only — no literal hex values, durations, or shadows
- [ ] Behaves correctly with `NEXT_PUBLIC_PMO_ENABLED` / `NEXT_PUBLIC_VOICE_ENABLED` off
- [ ] No `next-auth` imports; API paths added to `src/lib/api/paths.ts`, not inlined
- [ ] Loading / empty / error states handled, not just the happy path
- [ ] README / docs updated if behavior changed

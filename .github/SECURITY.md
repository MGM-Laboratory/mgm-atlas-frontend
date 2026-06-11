# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public issues,
discussions, or pull requests.**

Instead, use one of these private channels:

1. **Preferred:** GitHub private vulnerability reporting — click
   **"Report a vulnerability"** on this repository's
   [Security tab](https://github.com/MGM-Laboratory/mgm-atlas-frontend/security).
2. **Email:** [atlas@labmgm.org](mailto:atlas@labmgm.org) with the subject
   prefix `[SECURITY]`.

Include what you can: affected page/component, reproduction steps, impact
assessment, and any proof-of-concept material.

### What to expect

| Stage | Commitment |
|---|---|
| Acknowledgement | within **72 hours** |
| Status update | within **14 days** |
| Fix & disclosure | coordinated with you after a fix ships |

## Supported versions

MGM Atlas deploys continuously — there are no maintained release lines.

| Branch / deployment | Supported |
|---|---|
| `main` (production, atlas.labmgm.org) | ✅ |
| `dev` (staging) | ⚠️ best effort |
| Anything else | ❌ |

## Scope

In scope:

- This codebase: XSS and content-injection surfaces (chat markdown, rich
  text, link previews), session handling in the browser (localStorage),
  the OAuth callback route, the service worker and push handling
- The production deployment at `atlas.labmgm.org`

Out of scope:

- Vulnerabilities in upstream software (Keycloak, LiveKit, Next.js) —
  please report those upstream
- The API itself — report backend findings against
  [mgm-atlas-backend](https://github.com/MGM-Laboratory/mgm-atlas-backend/security)
- Volumetric denial-of-service, social engineering, or findings requiring a
  previously compromised account or device

## Safe harbor

We will not pursue action against good-faith research that respects user
privacy, avoids service disruption and data destruction, and gives us
reasonable time to remediate before any disclosure.

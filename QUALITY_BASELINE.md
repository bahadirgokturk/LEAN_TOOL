# Code Quality Baseline

Measured on 9 August 2026. This baseline covers the modern `src` tree. The
legacy applications under `public/5s` and `public/gemba` are intentionally
tracked as separate migration zones.

## Automated gates

| Check | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Pass |
| ESLint, including identifier casing | Pass |
| Vitest authorization, role, upload and rate-limit suite | 63 / 63 tests pass |
| Next.js production build | Pass |
| Knip unused dependencies/files/exports | 0 issues after first cleanup |
| Production dependency audit | 0 known vulnerabilities |
| jscpd duplicated lines, entire `src` | 0 / 5,320 lines (0.00%) |
| jscpd duplicated TypeScript lines | 0 / 2,858 lines (0.00%) |

## First cleanup

- Removed the unused `nodemailer` runtime dependency.
- Removed unused type/config development dependencies.
- Upgraded Next.js and `eslint-config-next` to 16.3.0 and patched DOMPurify to
  remove the known production dependency advisories.
- Made six module-internal helpers/constants private instead of exporting
  unused public symbols.
- Added machine-enforced identifier casing and a written English naming policy.
- Added behavior tests for valid, missing, legacy and invalid 5S sessions, plus
  role and plant-scope denial paths.
- Migrated the deprecated `src/middleware.ts` convention to the Next.js 16
  `src/proxy.ts` convention without changing session behavior.
- Standardized CI, Node type definitions and version-manager metadata on
  Node.js 22.
- Added route-level authorization coverage for all four 5S roles across
  admin-only writes, auditor writes and scoped reads.
- Fixed missing pagination parameters incorrectly resolving to the minimum
  value (`1`) instead of the documented default (`200`).
- Consolidated action/audit list pagination behind one tested helper, removing
  one production-code clone without changing the API contract.
- Consolidated scoped SQL visibility and Supabase callback/confirmation route
  plumbing behind tested helpers.
- Consolidated repeated role-test setup; jscpd now reports zero duplicate
  regions across the analyzed `src` tree.
- Replaced anonymous/public 5S photo storage with authenticated server-side
  upload and private, session-gated reads; added size, MIME and signature checks.
- Removed the JWT from the login JSON body, bounded notification fan-out,
  hardened AI provider failures/timeouts and expanded browser security headers.
- Added atomic, persistent per-user Supabase rate limits for AI and notification
  endpoints; the control fails closed if its database function is unavailable.

## Duplicate-code status

No duplicate region currently meets the configured jscpd detection threshold.
This is a measured baseline, not a reason to create premature abstractions for
short, coincidentally similar code in future changes.

## Legacy migration debt

- `public/legacy-app.js` and the static 5S/Gemba front ends are not covered by
  the TypeScript lint gate.
- Their user-visible strings should remain Turkish, while extracted internal
  modules must use English identifiers.
- Before extracting behavior, add characterization tests around the relevant
  login, audit, action or project-management flow.

## Next quality slice

Add route-level mutation tests for update/delete operations and introduce
coverage reporting with an agreed minimum threshold. Keep refactors focused on
security-sensitive or frequently changed code rather than chasing a percentage.

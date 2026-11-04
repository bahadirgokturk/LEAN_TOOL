# Dependency security maintenance — 2026-11-04

## Scope

Repair the failing production dependency audit without disabling the CI gate,
changing authentication, or touching stored records/photos.

- Next.js: 16.3.8 → 16.4.5; matching eslint-config-next pinned to 16.4.5.
- Zod: 4.4.3 → 4.6.6 (pinned).
- npm regenerated package-lock.json; reviewed changes are Next's matching
  platform/compiler packages, lint plugin, its fastq dependency, and Zod.
- Installation used `--ignore-scripts`; no new install-script policy or scripts
  were enabled. No database migration or data write was performed.

## Evidence

- Before: production audit reported Next critical and Zod high findings.
- After: `npm audit --omit=dev --audit-level=moderate` reports 0 vulnerabilities.
- Existing 152 tests passed after the Next upgrade and after the Zod upgrade.
- `npm audit signatures`: 473 registry signatures and 118 attestations verified.
- Typecheck, lint, and dead-code analysis passed. Duplicate analysis remains
  within the existing threshold (0.20% duplicated lines).

Official release notes:

- https://github.com/vercel/next.js/releases/tag/v16.4.5
- https://github.com/colinhacks/zod/releases/tag/v4.6.6

## Remaining development-tool findings

The full audit (including devDependencies) still reports 22 findings:
19 moderate and 3 high, in the lint/test tool dependency graph. This is not a
claim that the entire repository has zero security risk. Production audit is
the existing CI release gate, which has not been weakened.

Examples include brace-expansion, js-yaml and Vite, with propagated findings
through ESLint and Vitest. These tools execute during development/CI, so they
still warrant remediation; they are not being dismissed as harmless. Review
by 2026-11-11 in a separate tooling update. Do not apply `npm audit fix --force`:
the current suggestions include incompatible ESLint/Next lint downgrades.
Until reviewed, do not run these tools against untrusted source/configuration.

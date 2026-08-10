# Yalın Tool Strix Security Scan Rules of Engagement

## Authorized target

- Test only the local Yalın Tool source tree supplied as the Strix target.
- Review application-owned Next.js pages, API routes, authentication,
  authorization, Supabase access, file uploads, AI endpoints, notifications,
  and the legacy 5S/Gemba browser applications.

## Explicit exclusions

- Do not attack, enumerate, or modify Supabase, Vercel, GitHub, OpenAI, email
  providers, or any other third-party infrastructure during this source scan.
- Do not send requests to production or preview deployments in this phase.
- Do not use denial-of-service, credential stuffing, persistence, destructive
  payloads, data deletion, or secret rotation.
- Do not modify source files, create pull requests, or apply automatic fixes.
- Never copy environment values, credentials, personal data, audit photos, or
  session tokens into findings or reports.

## Priority review areas

1. Cross-factory and cross-department IDOR in audits, actions, plans, users,
   areas, forms, dashboard data, and private audit photos.
2. Role escalation across admin, auditor, department, and team-leader roles.
3. Session, password reset, cookie, redirect, CSRF, and brute-force behavior.
4. SQL injection, stored/reflected DOM XSS, unsafe innerHTML, CSV/PDF export,
   mass assignment, prototype pollution, and verbose error leakage.
5. Private Storage bypass, forged image upload, MIME confusion, path traversal,
   service-role exposure, and public legacy-photo access.
6. AI prompt injection, untrusted model output, secret/context leakage, rate
   limit bypass, and unbounded model or notification cost paths.
7. Security header, dependency, supply-chain, and deployment configuration gaps.

## Evidence standard

- Report only findings grounded in a concrete code path.
- Include file and line references, prerequisites, impact, and a safe local
  reproduction procedure.
- Separate confirmed vulnerabilities from hypotheses requiring an isolated
  staging-data retest.
- Treat documented business rules as context, not as proof that a path is safe.


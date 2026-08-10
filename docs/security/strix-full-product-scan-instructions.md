# Yalın Tool Full-Product Strix Rules of Engagement

## Authorized target and required coverage

Review the complete local Yalın Tool source tree as one product. This pass must
prioritize surfaces not fully exercised by the earlier 5S-focused pass:

1. Project Management application under `src/app/app`, including its legacy DOM
   application, Supabase bridge, authentication, projects, members, tasks,
   actions, approvals, reports, exports, and client-side data handling.
2. Gemba applications under `public/gemba`, including anonymous submissions,
   admin authentication, public/private Storage access, CRUD operations,
   realtime subscriptions, cache/service-worker behavior, and all Supabase RLS
   assumptions.
3. Shared Next.js and Supabase authentication flows, password recovery,
   middleware/proxy rules, redirects, cookies, and session boundaries.
4. `/api/ai` and `/api/notify`: authorization, cross-project IDOR, prompt
   injection, model-output handling, secret/context leakage, recipient control,
   request limits, and cost/rate-limit bypass.
5. File/media upload, CSV/PDF/report export, stored/reflected/DOM XSS, formula
   injection, MIME confusion, path traversal, mass assignment, prototype
   pollution, verbose errors, dependencies, headers, and deployment config.
6. Cross-module trust boundaries between the hub, Project Management, Gemba,
   and 5S. Do not repeat an already reported 5S finding unless it enables a
   distinct cross-module exploit chain.

## Explicit exclusions

- Do not send requests to Vercel Preview or production deployments.
- Do not contact, enumerate, authenticate to, modify, upload to, or delete from
  any Supabase project or other third-party service.
- Do not invoke Anthropic, SendGrid, OpenAI, GitHub, or external CDN endpoints.
- Do not use real credentials, personal data, project records, findings, media,
  audit photos, email addresses, or session tokens.
- Do not perform denial-of-service, credential stuffing, persistence, secret
  rotation, destructive payloads, source modification, or automatic fixes.
- Dynamic validation is allowed only in a fully local harness with network
  calls stubbed or blocked and synthetic test data.

## Evidence standard

- Report only concrete, exploitable code paths with file and line references.
- Prove authorization findings against the actual role/project/tenant boundary.
- Treat public Supabase configuration as context; do not report an anon key by
  itself as a secret. Report only an exploitable RLS or data-access consequence.
- Separate confirmed findings from hypotheses requiring a future isolated
  staging-data test.
- Never include credential values, tokens, PII, business data, or media in
  reports.


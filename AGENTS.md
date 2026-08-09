# Agent instructions

Follow `CODE_QUALITY.md` for every code change.

- Write source-code identifiers in English. Turkish is for user-facing text.
- Preserve universal Lean terms such as gemba, kaizen and kanban.
- Do not perform repository-wide rewrites or blind global renames.
- Refactor one behavior or module at a time and preserve external behavior.
- Treat database columns, API fields and DOM IDs as contracts; adapt them at
  typed boundaries unless a migration is explicitly requested.
- Never delete a file, export or dependency only because a tool marks it
  unused. Verify references, dynamic loading and framework conventions first.
- Run typecheck and lint after each refactor slice; run the production build
  before declaring the task complete.
- New security-sensitive behavior requires tests for both allowed and denied
  roles.

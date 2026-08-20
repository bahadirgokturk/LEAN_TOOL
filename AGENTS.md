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

## Language of new code

- TypeScript is the default for all new code. Do not add new `.js` files.
- `src/**` is TypeScript under `strict`; keep it that way.
- The 5S browser app is being migrated file by file. `src/5s-client/*.ts` is
  the source; `npm run build:5s` writes the plain script into `public/5s/js`
  and both are committed, so deployment keeps serving static files as before.
  Never edit a generated file in `public/5s/js` — it carries a banner saying so.
- `public/5s/js/*.js` files without that banner are not migrated yet. When you
  touch one, migrating it is the preferred move; growing it is not.
- New browser-side behavior that can live in `src/**` belongs there.

## Lessons this project has already paid for

Read these before changing the 5S module; each one cost production data.

1. Code deploys automatically, `supabase/*.sql` does not. A deploy can reach
   production before its migration. Never let a missing column fail a write
   that carries user work — degrade, log, and report through
   `GET /api/s5/health/schema`.
2. A half-filled audit is user work. Anything that can lose it (failed save,
   dropped session, edit that omits a field) is a defect, not an edge case.
3. Deleting a user or an area does not delete audits, it unlinks them — and an
   unlinked audit disappears from the lists people actually look at.
4. The Supabase plan has no point-in-time recovery. Destructive operations get
   an archive path, not a hard delete.
5. `public/5s/js` has no type checker and no bundler. Verify changes there in a
   real browser, not by reasoning alone.

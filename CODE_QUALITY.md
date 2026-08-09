# Yalın Tool Code Quality Standard

This document is the shared acceptance standard for human- and AI-authored
code. A change is evaluated by its evidence, not by which tool produced it.

## Language and naming

- Source-code identifiers are English.
- Turkish is allowed in user-facing text, email content and business reports.
- Universal Lean terms remain unchanged: `gemba`, `kaizen`, `kanban`,
  `hoshin`, `andon` and `poka-yoke`.
- Variables, functions and methods use `camelCase`.
- React components, classes, types and interfaces use `PascalCase`.
- Environment variables and true module constants use `UPPER_CASE`.
- Boolean names start with `is`, `has`, `can`, `should` or `was`.
- Function names start with a verb such as `get`, `list`, `load`, `create`,
  `update`, `delete`, `validate`, `calculate` or `format`.
- Avoid unclear abbreviations and placeholder names such as `data2`, `obj`,
  `tmp`, `stuff`, `thing` and `result2`.

## Boundary rule for legacy Turkish fields

Database columns, API payloads and DOM IDs are external contracts. Do not
rename them with global search-and-replace. Translate them once at a typed
boundary and keep internal identifiers English.

```ts
const audit = {
  areaId: databaseRow.area_id,
  auditorName: databaseRow.denetci_adi,
};
```

Database or API contract renames require a separate migration, compatibility
period and rollback plan.

## Structure

- Route handlers authenticate, authorize, validate and delegate.
- Business rules belong in focused service functions.
- Database access stays behind repository/data-access functions.
- Prefer guard clauses over deeply nested conditionals.
- Extract shared code only when it removes proven duplication.
- Do not create abstractions for hypothetical future use.
- Public API shapes and user-visible behavior must not change during a pure
  refactor.

## Legacy modules

The files under `public/5s`, `public/gemba` and the Project Management legacy
shell predate the current TypeScript architecture. They are migration zones,
not examples for new code.

- Do not rewrite a legacy module in one pass.
- Add characterization tests before changing behavior.
- Move one behavior at a time behind a typed boundary.
- Run typecheck, lint, focused tests and build after each slice.

## Required evidence

Run these checks for every refactor:

```bash
npm run typecheck
npm run lint
npm run build
```

Run these analyses before cleanup work and record the baseline:

```bash
npm run analyze:deadcode
npm run analyze:duplicates
```

Knip and duplication findings are investigation inputs, not automatic delete
instructions. Verify dynamic imports, Next.js conventions and public contracts
before removing anything.

## Definition of done

- Behavior is covered by an existing or new test.
- Typecheck and lint pass.
- Production build succeeds.
- No new unexplained dead code or duplication is introduced.
- Security-sensitive changes include authorization tests.
- Naming follows this document, including English internal identifiers.
- The change is small enough to review and revert independently.

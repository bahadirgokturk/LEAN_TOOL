import { isScopedRole, requireScope, type S5User } from "./auth";

/** Columns of `s5_users` that may be returned to a client (never the hash). */
export const USER_PUBLIC_COLUMNS =
  "id, username, name, role, dept, fabrika, bolum, created_at";

/** Audits joined with their area, used by both the list and detail endpoints. */
export const AUDIT_BASE_SELECT = `
  SELECT a.*, ar.name AS joined_area_name, ar.dept, ar.alt_dept, ar.fabrika AS area_fabrika
  FROM s5_audits a
  LEFT JOIN s5_areas ar ON ar.id = a.area_id
`;

/**
 * Accumulates SQL conditions with their bind parameters.
 *
 * Keeps placeholder numbering correct automatically — the previous code tracked
 * an index by hand, which is exactly the kind of thing that drifts when a
 * condition is added.
 */
export function createConditions() {
  const conditions: string[] = [];
  const params: unknown[] = [];

  return {
    /** `add((p) => \`a.date >= ${p}\`, value)` → appends `a.date >= $n`. */
    add(build: (placeholder: string) => string, value: unknown) {
      params.push(value);
      conditions.push(build(`$${params.length}`));
    },
    /** Reserves the next placeholder without adding a condition (LIMIT/OFFSET). */
    bind(value: unknown): string {
      params.push(value);
      return `$${params.length}`;
    },
    get whereClause(): string {
      return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    },
    get values(): unknown[] {
      return params;
    },
  };
}

export type Conditions = ReturnType<typeof createConditions>;

/**
 * Restricts audit rows to what `user` is allowed to see.
 *
 * `denetci` sees only their own audits; `departman`/`takimlider` are limited to
 * their plant (and department when one is assigned). Scoped roles without a
 * plant assignment are rejected by {@link requireScope} rather than silently
 * being granted access to everything.
 */
export function applyAuditVisibility(conditions: Conditions, user: S5User): void {
  if (user.role === "denetci") {
    conditions.add((p) => `a.auditor_id = ${p}`, user.id);
    return;
  }
  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    conditions.add((p) => `ar.fabrika = ${p}`, scope.plant);
    if (scope.department) {
      conditions.add((p) => `ar.dept = ${p}`, scope.department);
    }
  }
}

/** Same restriction expressed against `s5_actions ac` joined to `s5_areas ar`. */
export function applyActionVisibility(conditions: Conditions, user: S5User): void {
  if (user.role === "denetci") {
    conditions.add(
      (p) => `EXISTS (SELECT 1 FROM s5_audits a WHERE a.id = ac.audit_id AND a.auditor_id = ${p})`,
      user.id
    );
    return;
  }
  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    conditions.add((p) => `ar.fabrika = ${p}`, scope.plant);
    if (scope.department) {
      conditions.add((p) => `ar.dept = ${p}`, scope.department);
    }
  }
}

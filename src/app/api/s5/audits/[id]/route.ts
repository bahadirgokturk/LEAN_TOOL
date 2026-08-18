import { NextResponse } from "next/server";
import { isUndefinedColumnError, query } from "@/lib/s5/db";
import { isScopedRole, requireScope, stripAngleBrackets, stripAngleBracketsDeep, type S5User } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updateAuditSchema } from "@/lib/s5/schemas";
import { AUDIT_BASE_SELECT } from "@/lib/s5/sql";

type AuditRow = {
  id: string;
  auditor_id: string | null;
  auditor_name: string | null;
  area_fabrika: string | null;
  [column: string]: unknown;
};

export const GET = protectedRoute<{ id: string }>({}, async ({ user, params }) => {
  const audit = await loadAudit(params.id);
  assertCanAccess(user, audit);
  return NextResponse.json(audit);
});

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin", "denetci"] },
  async ({ req, user, params }) => {
    const existing = await loadAudit(params.id);
    assertCanAccess(user, existing);

    const patch = await parseBody(req, updateAuditSchema);

    // Merge semantics: an omitted field keeps its stored value. Sending `{}`
    // must not blank the record.
    const values = [
      patch.area_id ?? existing.area_id,
      patch.area_name !== undefined
        ? stripAngleBrackets(patch.area_name, 128)
        : existing.area_name,
      patch.date ?? existing.date,
      patch.shift !== undefined ? stripAngleBrackets(patch.shift, 16) : existing.shift,
      patch.total_score ?? existing.total_score,
      JSON.stringify(stripAngleBracketsDeep(patch.pillars_json ?? existing.pillars_json)),
      JSON.stringify(stripAngleBracketsDeep(patch.answers_json ?? existing.answers_json)),
      JSON.stringify(stripAngleBracketsDeep(patch.notes_json ?? existing.notes_json)),
      JSON.stringify(patch.photos_json ?? existing.photos_json),
      patch.status ?? existing.status,
      patch.form_code !== undefined
        ? stripAngleBrackets(patch.form_code, 64)
        : existing.form_code,
      patch.location !== undefined
        ? stripAngleBrackets(patch.location, 128)
        : existing.location,
      patch.team_leader !== undefined
        ? stripAngleBrackets(patch.team_leader, 128)
        : existing.team_leader,
      patch.form_template_id !== undefined
        ? patch.form_template_id
        : existing.form_template_id,
      params.id,
    ];

    const updated = await updateAudit(values);
    return NextResponse.json(updated);
  }
);

/**
 * Archives an audit instead of destroying it.
 *
 * A single mis-click used to remove the row for good: this project runs on a
 * Supabase plan without point-in-time recovery, so a deleted audit — half an
 * hour of someone walking the floor — is unrecoverable. The row is moved to
 * status `iptal` instead, which the list endpoint hides by default and an admin
 * can reverse (`?status=iptal` lists them; see README).
 *
 * `iptal` is part of the status CHECK constraint from the original schema, so
 * this needs no migration and cannot fail on a database that is behind.
 */
export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query(
    "UPDATE s5_audits SET status='iptal', updated_at=NOW() WHERE id=$1 AND status<>'iptal'",
    [params.id]
  );
  if (!rowCount) throw new HttpError(404, "Denetim bulunamadı");
  return NextResponse.json({ ok: true, archived: true });
});

const AUDIT_UPDATE_SQL = `
  UPDATE s5_audits SET
    area_id=$1, area_name=$2, date=$3, shift=$4, total_score=$5,
    pillars_json=$6, answers_json=$7, notes_json=$8, photos_json=$9,
    status=$10, form_code=$11, location=$12, team_leader=$13,
    form_template_id=$14
  WHERE id=$15 RETURNING *`;

/** Same statement without `form_template_id`, for a database still awaiting the migration. */
const AUDIT_UPDATE_SQL_WITHOUT_TEMPLATE = `
  UPDATE s5_audits SET
    area_id=$1, area_name=$2, date=$3, shift=$4, total_score=$5,
    pillars_json=$6, answers_json=$7, notes_json=$8, photos_json=$9,
    status=$10, form_code=$11, location=$12, team_leader=$13
  WHERE id=$14 RETURNING *`;

/**
 * Writes the audit, tolerating a `form_template_id` column that has not been
 * migrated yet (`supabase/s5-form-active.sql`).
 *
 * Mirrors the insert path: an un-migrated metadata column must never cost the
 * user the audit itself.
 */
async function updateAudit(values: unknown[]) {
  try {
    const { rows } = await query(AUDIT_UPDATE_SQL, values);
    return rows[0];
  } catch (error) {
    if (!isUndefinedColumnError(error)) throw error;
    console.warn(
      "[s5] s5_audits.form_template_id is missing — audit updated without it. Run supabase/s5-form-active.sql."
    );
    const withoutTemplate = [...values.slice(0, 13), values[14]];
    const { rows } = await query(AUDIT_UPDATE_SQL_WITHOUT_TEMPLATE, withoutTemplate);
    return rows[0];
  }
}

async function loadAudit(id: string): Promise<AuditRow> {
  const { rows } = await query<AuditRow>(`${AUDIT_BASE_SELECT} WHERE a.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Denetim bulunamadı");
  return rows[0];
}

/** Auditors may only touch their own audits; scoped roles only their plant/department. */
function assertCanAccess(user: S5User, audit: AuditRow): void {
  if (user.role === "admin") return;
  // An audit whose auditor account was deleted keeps only `auditor_name`
  // (ON DELETE SET NULL), so the name carries those orphaned rows. See
  // `ownAuditCondition` in lib/s5/sql.ts, which applies the same rule to lists.
  if (user.role === "denetci") {
    const isOwn =
      audit.auditor_id === user.id ||
      (audit.auditor_id === null && audit.auditor_name === user.name);
    if (!isOwn) throw new HttpError(403, "Bu denetime erişim yetkiniz yok");
  }
  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    if (audit.area_fabrika !== scope.plant || (scope.department && audit.dept !== scope.department)) {
      throw new HttpError(403, "Bu denetime erişim yetkiniz yok");
    }
  }
}

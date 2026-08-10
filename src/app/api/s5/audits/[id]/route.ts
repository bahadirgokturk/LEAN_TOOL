import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { isScopedRole, requireScope, stripAngleBrackets, stripAngleBracketsDeep, type S5User } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updateAuditSchema } from "@/lib/s5/schemas";
import { AUDIT_BASE_SELECT } from "@/lib/s5/sql";

type AuditRow = {
  id: string;
  auditor_id: string | null;
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
    const { rows } = await query(
      `UPDATE s5_audits SET
         area_id=$1, area_name=$2, date=$3, shift=$4, total_score=$5,
         pillars_json=$6, answers_json=$7, notes_json=$8, photos_json=$9,
         status=$10, form_code=$11, location=$12, team_leader=$13
       WHERE id=$14 RETURNING *`,
      [
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
        params.id,
      ]
    );
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query("DELETE FROM s5_audits WHERE id=$1", [params.id]);
  if (!rowCount) throw new HttpError(404, "Denetim bulunamadı");
  return NextResponse.json({ ok: true });
});

async function loadAudit(id: string): Promise<AuditRow> {
  const { rows } = await query<AuditRow>(`${AUDIT_BASE_SELECT} WHERE a.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "Denetim bulunamadı");
  return rows[0];
}

/** Auditors may only touch their own audits; scoped roles only their plant/department. */
function assertCanAccess(user: S5User, audit: AuditRow): void {
  if (user.role === "admin") return;
  if (user.role === "denetci" && audit.auditor_id !== user.id) {
    throw new HttpError(403, "Bu denetime erişim yetkiniz yok");
  }
  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    if (audit.area_fabrika !== scope.plant || (scope.department && audit.dept !== scope.department)) {
      throw new HttpError(403, "Bu denetime erişim yetkiniz yok");
    }
  }
}

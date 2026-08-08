import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets, type S5User } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updateActionSchema } from "@/lib/s5/schemas";
import { applyActionVisibility, createConditions } from "@/lib/s5/sql";

/**
 * Restricts a single-row lookup to what `user` may see.
 *
 * The list endpoint has always scoped by role; reading or writing a row by id
 * previously bypassed that, so any auditor could reach any factory's actions.
 * Both paths now share {@link applyActionVisibility}.
 */
function scopedSelect(user: S5User, actionId: string) {
  const conditions = createConditions();
  conditions.add((p) => `ac.id = ${p}`, actionId);
  applyActionVisibility(conditions, user);
  return conditions;
}

export const GET = protectedRoute<{ id: string }>({}, async ({ user, params }) => {
  const conditions = scopedSelect(user, params.id);
  const { rows } = await query(
    `SELECT ac.* FROM s5_actions ac
       LEFT JOIN s5_areas ar ON ar.id = ac.area_id
       ${conditions.whereClause}`,
    conditions.values
  );
  if (!rows[0]) throw new HttpError(404, "Aksiyon bulunamadı");
  return NextResponse.json(rows[0]);
});

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin", "denetci"] },
  async ({ req, user, params }) => {
    const patch = await parseBody(req, updateActionSchema);

    const existingConditions = scopedSelect(user, params.id);
    const { rows: existingRows } = await query(
      `SELECT ac.* FROM s5_actions ac
         LEFT JOIN s5_areas ar ON ar.id = ac.area_id
         ${existingConditions.whereClause}`,
      existingConditions.values
    );
    const existing = existingRows[0];
    if (!existing) throw new HttpError(404, "Aksiyon bulunamadı");

    // Merge semantics — an omitted field keeps its stored value.
    const { rows } = await query(
      `UPDATE s5_actions
          SET description=$1, assigned_to=$2, due_date=$3, status=$4, priority=$5,
              area_id=$6, area_name=$7
        WHERE id=$8 RETURNING *`,
      [
        patch.description !== undefined
          ? stripAngleBrackets(patch.description, 2000)
          : existing.description,
        patch.assigned_to !== undefined
          ? stripAngleBrackets(patch.assigned_to, 128)
          : existing.assigned_to,
        patch.due_date !== undefined ? patch.due_date : existing.due_date,
        patch.status ?? existing.status,
        patch.priority ?? existing.priority,
        patch.area_id !== undefined ? patch.area_id : existing.area_id,
        patch.area_name !== undefined
          ? stripAngleBrackets(patch.area_name, 128)
          : existing.area_name,
        params.id,
      ]
    );
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query("DELETE FROM s5_actions WHERE id=$1", [params.id]);
  if (!rowCount) throw new HttpError(404, "Aksiyon bulunamadı");
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updatePlanSchema } from "@/lib/s5/schemas";

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin", "denetci"] },
  async ({ req, user, params }) => {
    const { status, completed_audit_id } = await parseBody(req, updatePlanSchema);

    // An auditor may only close their own assignment. Expressing the ownership
    // check as part of the UPDATE keeps it atomic — a separate read-then-write
    // would leave a window where the row could change underneath us.
    const ownershipClause = user.role === "denetci" ? "AND auditor_id = $4" : "";
    const values: unknown[] = [status, completed_audit_id ?? null, params.id];
    if (user.role === "denetci") values.push(user.id);

    const { rows } = await query(
      `UPDATE s5_audit_plans SET status=$1, completed_audit_id=$2
        WHERE id=$3 ${ownershipClause} RETURNING *`,
      values
    );
    if (!rows[0]) throw new HttpError(404, "Atama bulunamadı");
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query("DELETE FROM s5_audit_plans WHERE id=$1", [params.id]);
  if (!rowCount) throw new HttpError(404, "Atama bulunamadı");
  return NextResponse.json({ ok: true });
});

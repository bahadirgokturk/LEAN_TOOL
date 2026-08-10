import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { protectedRoute } from "@/lib/s5/route";
import { applyScopedAreaVisibility, createConditions } from "@/lib/s5/sql";

/** Audit assignments. Auditors see only the plans assigned to them. */
export const GET = protectedRoute({}, async ({ user }) => {
  const conditions = createConditions();
  if (user.role === "denetci") {
    conditions.add((p) => `p.auditor_id = ${p}`, user.id);
  } else {
    applyScopedAreaVisibility(conditions, user);
  }

  const { rows } = await query(
    `SELECT p.* FROM s5_audit_plans p
       LEFT JOIN s5_areas ar ON ar.id = p.area_id
       ${conditions.whereClause}
       ORDER BY p.planned_date ASC`,
    conditions.values
  );
  return NextResponse.json(rows);
});

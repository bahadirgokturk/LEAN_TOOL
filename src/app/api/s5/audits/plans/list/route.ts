import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { protectedRoute } from "@/lib/s5/route";
import { createConditions } from "@/lib/s5/sql";

/** Audit assignments. Auditors see only the plans assigned to them. */
export const GET = protectedRoute({}, async ({ user }) => {
  const conditions = createConditions();
  if (user.role === "denetci") {
    conditions.add((p) => `auditor_id = ${p}`, user.id);
  }

  const { rows } = await query(
    `SELECT * FROM s5_audit_plans ${conditions.whereClause} ORDER BY planned_date ASC`,
    conditions.values
  );
  return NextResponse.json(rows);
});

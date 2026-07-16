import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, errorResponse } from "@/lib/s5/auth";

// GET /api/s5/audits/plans/list
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    let sql = "SELECT * FROM s5_audit_plans WHERE 1=1";
    const params: unknown[] = [];

    if (user.role === "denetci") {
      sql += ` AND auditor_id = $${params.length + 1}`;
      params.push(user.id);
    }
    sql += " ORDER BY planned_date ASC";

    const { rows } = await q(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

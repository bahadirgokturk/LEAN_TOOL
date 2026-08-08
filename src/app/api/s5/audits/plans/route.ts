import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets } from "@/lib/s5/auth";
import { parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { createPlanSchema } from "@/lib/s5/schemas";

/** Creates an audit assignment. */
export const POST = protectedRoute({ roles: ["admin"] }, async ({ req, user }) => {
  const body = await parseBody(req, createPlanSchema);

  const { rows } = await query(
    `INSERT INTO s5_audit_plans
       (area_id, area_name, auditor_id, auditor_name, planned_date, shift, form_template_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      body.area_id,
      stripAngleBrackets(body.area_name, 128),
      body.auditor_id,
      stripAngleBrackets(body.auditor_name, 128),
      body.planned_date,
      stripAngleBrackets(body.shift, 16),
      body.form_template_id ?? "default",
      stripAngleBrackets(body.notes, 2000),
      user.id,
    ]
  );
  return NextResponse.json(rows[0], { status: 201 });
});

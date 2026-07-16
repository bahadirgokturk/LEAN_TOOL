import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse } from "@/lib/s5/auth";

// POST /api/s5/audits/plans — Denetim ataması oluştur (sadece admin)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");

    const { area_id, area_name, auditor_id, auditor_name, planned_date, shift, form_template_id, notes } =
      await req.json();

    if (!area_id || !auditor_id || !planned_date) {
      return NextResponse.json({ error: "area_id, auditor_id, planned_date zorunlu" }, { status: 400 });
    }

    const { rows } = await q(
      `INSERT INTO s5_audit_plans
         (area_id, area_name, auditor_id, auditor_name, planned_date, shift, form_template_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [area_id, area_name || "", auditor_id, auditor_name || "", planned_date,
       shift || "", form_template_id || "default", notes || "", user.id]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

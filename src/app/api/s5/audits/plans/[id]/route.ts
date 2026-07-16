import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse } from "@/lib/s5/auth";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/s5/audits/plans/:id
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin", "denetci");
    const { id } = await ctx.params;

    const { status, completed_audit_id } = await req.json();
    const { rows } = await q(
      "UPDATE s5_audit_plans SET status=$1, completed_audit_id=$2 WHERE id=$3 RETURNING *",
      [status, completed_audit_id || null, id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Atama bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/s5/audits/plans/:id
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rowCount } = await q("DELETE FROM s5_audit_plans WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Atama bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

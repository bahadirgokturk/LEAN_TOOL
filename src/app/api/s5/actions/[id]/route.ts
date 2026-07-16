import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse } from "@/lib/s5/auth";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/s5/actions/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    requireUser(req);
    const { id } = await ctx.params;
    const { rows } = await q("SELECT * FROM s5_actions WHERE id=$1", [id]);
    if (!rows[0]) return NextResponse.json({ error: "Aksiyon bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/s5/actions/:id — Aksiyon güncelle (admin + denetci)
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin", "denetci");
    const { id } = await ctx.params;

    const { description, assigned_to, due_date, status, priority, area_id, area_name } =
      await req.json();
    const { rows } = await q(
      `UPDATE s5_actions SET description=$1, assigned_to=$2, due_date=$3, status=$4, priority=$5,
         area_id=COALESCE($6, area_id), area_name=COALESCE($7, area_name)
       WHERE id=$8 RETURNING *`,
      [description, assigned_to || "", due_date || null, status || "Açık", priority || "Orta",
       area_id || null, area_name || null, id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Aksiyon bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/s5/actions/:id — Sadece admin
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rowCount } = await q("DELETE FROM s5_actions WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Aksiyon bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

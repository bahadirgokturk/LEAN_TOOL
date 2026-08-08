import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, sanitizeText } from "@/lib/s5/auth";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/s5/areas/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    requireUser(req);
    const { id } = await ctx.params;
    const { rows } = await q("SELECT * FROM s5_areas WHERE id = $1", [id]);
    if (!rows[0]) return NextResponse.json({ error: "Bölge bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/s5/areas/:id — Bölge güncelle (sadece admin)
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { name, dept, alt_dept, fabrika, description } = await req.json();
    const { rows } = await q(
      `UPDATE s5_areas SET name=$1, dept=$2, alt_dept=$3, fabrika=$4, description=$5
       WHERE id=$6 RETURNING *`,
      [sanitizeText(name,128), sanitizeText(dept,128), sanitizeText(alt_dept,128), sanitizeText(fabrika,128), sanitizeText(description,2000), id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Bölge bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/s5/areas/:id — Bölge sil (sadece admin)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rowCount } = await q("DELETE FROM s5_areas WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Bölge bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

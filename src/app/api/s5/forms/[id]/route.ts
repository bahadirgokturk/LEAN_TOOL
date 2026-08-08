import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, sanitizeText, sanitizeDeep } from "@/lib/s5/auth";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/s5/forms/:id — Şablonu güncelle (sadece admin)
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { adi, aciklama, pillarlar } = await req.json();
    if (!adi) return NextResponse.json({ error: "adi zorunlu" }, { status: 400 });

    const { rows } = await q(
      `UPDATE s5_form_templates SET adi=$1, aciklama=$2, pillarlar=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [sanitizeText(adi,128), sanitizeText(aciklama,2000), JSON.stringify(sanitizeDeep(pillarlar || [])), id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Şablon bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/s5/forms/:id — Şablon sil (sadece admin)
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rowCount } = await q("DELETE FROM s5_form_templates WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Şablon bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

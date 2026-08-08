import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, sanitizeText, sanitizeDeep } from "@/lib/s5/auth";

// GET /api/s5/forms — Tüm form şablonları
export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    const { rows } = await q("SELECT * FROM s5_form_templates ORDER BY created_at ASC");
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/s5/forms — Yeni şablon oluştur (sadece admin)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");

    const { adi, aciklama, pillarlar } = await req.json();
    if (!adi) return NextResponse.json({ error: "adi zorunlu" }, { status: 400 });

    const { rows } = await q(
      `INSERT INTO s5_form_templates (adi, aciklama, pillarlar, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [sanitizeText(adi,128), sanitizeText(aciklama,2000), JSON.stringify(sanitizeDeep(pillarlar || [])), user.id]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

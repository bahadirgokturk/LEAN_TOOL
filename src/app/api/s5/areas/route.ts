import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, isUniqueViolation, sanitizeText } from "@/lib/s5/auth";

// GET /api/s5/areas — Bölgeleri listele (role'e göre filtrele)
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    let sql = "SELECT * FROM s5_areas ORDER BY fabrika, dept, alt_dept, name";
    const params: unknown[] = [];

    if (user.role === "departman" || user.role === "takimlider") {
      if (user.fabrika && user.dept) {
        sql = "SELECT * FROM s5_areas WHERE fabrika = $1 AND dept = $2 ORDER BY alt_dept, name";
        params.push(user.fabrika, user.dept);
      } else if (user.fabrika) {
        sql = "SELECT * FROM s5_areas WHERE fabrika = $1 ORDER BY dept, alt_dept, name";
        params.push(user.fabrika);
      }
    }

    const { rows } = await q(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/s5/areas — Yeni bölge oluştur (sadece admin)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");

    const { id, name, dept, alt_dept, fabrika, description } = await req.json();
    if (!id || !name) return NextResponse.json({ error: "id ve name zorunlu" }, { status: 400 });

    const { rows } = await q(
      `INSERT INTO s5_areas (id, name, dept, alt_dept, fabrika, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, sanitizeText(name,128), sanitizeText(dept,128), sanitizeText(alt_dept,128), sanitizeText(fabrika,128), sanitizeText(description,2000)]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Bu ID zaten kullanımda" }, { status: 409 });
    }
    return errorResponse(err);
  }
}

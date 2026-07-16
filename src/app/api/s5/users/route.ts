import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, isUniqueViolation } from "@/lib/s5/auth";

const SAFE_COLS = "id, username, name, role, dept, fabrika, bolum, created_at";

// GET /api/s5/users — Sadece admin tüm listeyi görebilir
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { rows } = await q(`SELECT ${SAFE_COLS} FROM s5_users ORDER BY role, name`);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/s5/users — Yeni kullanıcı oluştur (sadece admin)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");

    const { username, password, name, role, dept, fabrika, bolum } = await req.json();
    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: "username, password, name, role zorunlu" }, { status: 400 });
    }

    const validRoles = ["admin", "denetci", "departman", "takimlider"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Geçersiz rol" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(
      `INSERT INTO s5_users (username, password_hash, name, role, dept, fabrika, bolum)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${SAFE_COLS}`,
      [String(username).toLowerCase().trim(), hash, name, role, dept || "", fabrika || "", bolum || ""]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanımda" }, { status: 409 });
    }
    return errorResponse(err);
  }
}

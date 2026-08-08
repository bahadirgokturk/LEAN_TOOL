import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, isUniqueViolation, validatePassword, sanitizeText } from "@/lib/s5/auth";

const SAFE_COLS = "id, username, name, role, dept, fabrika, bolum, created_at";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/s5/users/:id (sadece admin)
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rows } = await q(`SELECT ${SAFE_COLS} FROM s5_users WHERE id=$1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/s5/users/:id — Kullanıcı güncelle (sadece admin)
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { name, username, role, dept, fabrika, bolum, password } = await req.json();

    if (password) {
      const pwError = validatePassword(password);
      if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
      const hash = await bcrypt.hash(password, 10);
      await q("UPDATE s5_users SET password_hash=$1, must_change_password=false, failed_attempts=0, locked_until=NULL WHERE id=$2", [hash, id]);
    }

    const uname = username ? String(username).toLowerCase().trim() : undefined;

    const { rows } = await q(
      `UPDATE s5_users SET name=$1, role=$2, dept=$3, fabrika=$4, bolum=$5
         ${uname ? ", username=$7" : ""}
       WHERE id=$6 RETURNING ${SAFE_COLS}`,
      uname
        ? [sanitizeText(name,128), role, sanitizeText(dept,128), sanitizeText(fabrika,128), sanitizeText(bolum,128), id, uname]
        : [sanitizeText(name,128), role, sanitizeText(dept,128), sanitizeText(fabrika,128), sanitizeText(bolum,128), id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten kullanımda" }, { status: 409 });
    }
    return errorResponse(err);
  }
}

// DELETE /api/s5/users/:id — Sadece admin, kendini silemez
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    if (id === user.id) {
      return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 });
    }
    const { rowCount } = await q("DELETE FROM s5_users WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

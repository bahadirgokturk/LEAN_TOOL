import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, errorResponse } from "@/lib/s5/auth";

// GET /api/s5/auth/me
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const { rows } = await q(
      "SELECT id, username, name, role, dept, fabrika, bolum FROM s5_users WHERE id = $1",
      [user.id]
    );
    if (!rows[0]) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    return NextResponse.json({ user: rows[0] });
  } catch (err) {
    return errorResponse(err);
  }
}

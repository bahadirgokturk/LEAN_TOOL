import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, errorResponse } from "@/lib/s5/auth";

const SAFE_COLS = "id, username, name, role, dept, fabrika, bolum, created_at";

// GET /api/s5/users/auditors — Denetçi listesi (tüm roller erişebilir)
export async function GET(req: NextRequest) {
  try {
    requireUser(req);
    const { rows } = await q(
      `SELECT ${SAFE_COLS} FROM s5_users WHERE role='denetci' ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

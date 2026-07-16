import { NextResponse } from "next/server";
import { S5_COOKIE } from "@/lib/s5/auth";

// POST /api/s5/auth/logout
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(S5_COOKIE);
  return res;
}

import { NextResponse } from "next/server";
import { S5_COOKIE } from "@/lib/s5/auth";

/** Clears the session cookie. Safe to call without a valid session. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(S5_COOKIE);
  return response;
}

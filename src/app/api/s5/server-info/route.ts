import { NextResponse, type NextRequest } from "next/server";

/**
 * Base URL that printed QR codes should point at.
 *
 * Unauthenticated on purpose: it exposes nothing beyond the request's own
 * origin, and the QR screen needs it before a session exists.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ networkUrl: `${req.nextUrl.origin}/5s/`, ip: null, port: null });
}

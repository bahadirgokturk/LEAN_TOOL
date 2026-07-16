import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 5S modülü auth — orijinal Express backend'in JWT + cookie mantığının birebir portu.
// Faz C'de ortak Supabase Auth'a geçilecek (SSO); şimdilik 5S kendi kullanıcı
// tablosuyla (s5_users) çalışır.

export const S5_COOKIE = "s5_token";

export type S5Role = "admin" | "denetci" | "departman" | "takimlider";

export type S5User = {
  id: string;
  username: string;
  name: string;
  role: S5Role;
  dept: string;
  fabrika: string;
  bolum: string;
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function secret(): string {
  const s = process.env.S5_JWT_SECRET;
  if (!s) throw new Error("S5_JWT_SECRET tanımlı değil.");
  return s;
}

export function signToken(user: S5User): string {
  return jwt.sign(user, secret(), { expiresIn: "8h" });
}

export function getUser(req: NextRequest): S5User | null {
  const token =
    req.cookies.get(S5_COOKIE)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    return jwt.verify(token, secret()) as S5User;
  } catch {
    return null;
  }
}

export function requireUser(req: NextRequest): S5User {
  const user = getUser(req);
  if (!user) throw new HttpError(401, "Oturum gerekli");
  return user;
}

export function requireRole(user: S5User, ...roles: S5Role[]): void {
  if (!roles.includes(user.role)) throw new HttpError(403, "Bu işlem için yetkiniz yok");
}

// Express'teki global hata yakalayıcının karşılığı: route'lar hataları buraya atar.
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Sunucu hatası";
  console.error("[s5]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

// Postgres unique violation → 409
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

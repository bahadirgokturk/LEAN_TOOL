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

// XSS savunması — metin alanlarını sunucuda temizler.
// 5S arayüzü eski bir kod tabanı: kullanıcı verisi 30+ yerde innerHTML ile
// basılıyor. Her render noktasını kaçışlamak yerine, veriyi TEK giriş
// noktasında temizliyoruz; böylece veritabanına hiç tehlikeli içerik girmez
// ve ileride eklenen bir render noktası da otomatik korunmuş olur.
// (Bölge adı, not, konum gibi alanlarda HTML'e zaten ihtiyaç yok.)
export function sanitizeText(value: unknown, maxLen = 2000): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[<>]/g, "")               // HTML etiketi açılmasını engeller
    .trim()
    .slice(0, maxLen);
}

// Denetim notları/cevapları iç içe JSON olarak saklanıp arayüzde basılıyor;
// bu yüzden yapının içindeki tüm metinler de temizlenir.
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map(sanitizeDeep) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out as unknown as T;
  }
  return value;
}

// Şifre politikası — zayıf/varsayılan şifreleri baştan engeller.
// Eskiden hiçbir kural yoktu; "1" bile kabul ediliyordu.
const WEAK_PASSWORDS = [
  "123456", "password", "sifre", "şifre", "admin", "admin123", "qwerty",
  "111111", "123123", "12345678", "1234567890", "abc123",
];

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Şifre en az 8 karakter olmalı.";
  }
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/[0-9]/.test(password)) {
    return "Şifre en az bir harf ve bir rakam içermeli.";
  }
  if (WEAK_PASSWORDS.includes(password.toLowerCase())) {
    return "Bu şifre çok yaygın, farklı bir şifre seçin.";
  }
  return null; // geçerli
}

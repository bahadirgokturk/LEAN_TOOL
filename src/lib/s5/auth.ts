import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { HttpError } from "./http";

/**
 * Authentication for the 5S module.
 *
 * 5S predates the shared Supabase Auth setup and carries its own JWT + bcrypt
 * credentials against the `s5_users` table. Migrating it onto the platform-wide
 * Supabase session is tracked separately (see SECURITY.md, "next steps").
 */

export const S5_COOKIE = "s5_token";

/**
 * Role vocabulary, persisted in `s5_users.role`.
 *
 * These values are Turkish because they are stored data from the original
 * system; renaming them would require a data migration. The English meaning:
 *   admin       — full access
 *   denetci     — auditor, sees only their own audits
 *   departman   — department viewer, scoped to one plant + department
 *   takimlider  — team lead, same scope as `departman`
 */
export const S5_ROLES = ["admin", "denetci", "departman", "takimlider"] as const;
export type S5Role = (typeof S5_ROLES)[number];

export function isS5Role(value: unknown): value is S5Role {
  return typeof value === "string" && (S5_ROLES as readonly string[]).includes(value);
}

/** Roles whose data access is limited to their own plant/department. */
const SCOPED_ROLES: S5Role[] = ["departman", "takimlider"];

export function isScopedRole(role: S5Role): boolean {
  return SCOPED_ROLES.includes(role);
}

/**
 * The authenticated principal.
 *
 * `plant` / `department` / `section` map to the Turkish DB columns
 * `fabrika` / `dept` / `bolum`. The mapping lives in `toS5User` alone so the
 * rest of the codebase reads in one language.
 */
export type S5User = {
  id: string;
  username: string;
  name: string;
  role: S5Role;
  plant: string;
  department: string;
  section: string;
};

/** Shape of an `s5_users` row as returned by Postgres. */
export type S5UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  fabrika?: string | null;
  dept?: string | null;
  bolum?: string | null;
  password_hash?: string;
  failed_attempts?: number | null;
  locked_until?: string | Date | null;
  must_change_password?: boolean | null;
  [column: string]: unknown;
};

/** Maps an `s5_users` row (Turkish columns) onto the application type. */
export function toS5User(row: S5UserRow): S5User {
  if (!isS5Role(row.role)) {
    throw new HttpError(500, "Kullanıcı rolü tanımsız.");
  }
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    plant: row.fabrika ?? "",
    department: row.dept ?? "",
    section: row.bolum ?? "",
  };
}

function getSecret(): string {
  const secret = process.env.S5_JWT_SECRET;
  if (!secret) throw new Error("S5_JWT_SECRET is not set.");
  return secret;
}

export function signToken(user: S5User): string {
  return jwt.sign(user, getSecret(), { expiresIn: "8h", algorithm: "HS256" });
}

/**
 * Reads the session from the request cookie.
 *
 * Tokens issued before the field rename carry `fabrika`/`dept`/`bolum`; both
 * shapes are accepted so existing sessions survive a deploy. Legacy claims age
 * out naturally within the 8 hour token lifetime.
 */
export function getUser(req: NextRequest): S5User | null {
  const token =
    req.cookies.get(S5_COOKIE)?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  try {
    const claims = jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as Record<
      string,
      unknown
    >;
    if (!isS5Role(claims.role)) return null;

    return {
      id: String(claims.id),
      username: String(claims.username),
      name: String(claims.name),
      role: claims.role,
      plant: String(claims.plant ?? claims.fabrika ?? ""),
      department: String(claims.department ?? claims.dept ?? ""),
      section: String(claims.section ?? claims.bolum ?? ""),
    };
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

/**
 * Returns the plant/department a scoped role is restricted to.
 *
 * Fails closed: a `departman` user with no plant assigned must see nothing
 * rather than everything, which is what an unguarded `if (user.plant)` would
 * have produced.
 */
export function requireScope(user: S5User): { plant: string; department: string } {
  if (!user.plant) {
    throw new HttpError(403, "Hesabınıza fabrika ataması yapılmamış. Yöneticinize başvurun.");
  }
  return { plant: user.plant, department: user.department };
}

/**
 * Removes angle brackets from free-text fields.
 *
 * This is defence in depth, NOT a substitute for escaping at render time: the
 * 5S and Gemba front-ends are legacy code that writes user data into
 * `innerHTML` in 30+ places. Stripping `<` and `>` on the way in guarantees no
 * stored payload can open a tag, and it cannot be forgotten the way a missed
 * escape call can. Any new render path should still escape properly.
 */
export function stripAngleBrackets(value: unknown, maxLength = 2000): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[<>]/g, "").trim().slice(0, maxLength);
}

/** Applies {@link stripAngleBrackets} to every string inside a nested structure. */
export function stripAngleBracketsDeep<T>(value: T, depth = 0): T {
  // Guards against a hand-crafted deeply nested payload exhausting the stack.
  if (depth > 20) return null as unknown as T;
  if (typeof value === "string") return stripAngleBrackets(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((item) => stripAngleBracketsDeep(item, depth + 1)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = stripAngleBracketsDeep(item, depth + 1);
    }
    return result as unknown as T;
  }
  return value;
}

/** Restricts usernames to characters that are unambiguous to type. */
export function normaliseUsername(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "");
}

/** Rejects passwords that are too short, too simple, or known to be common. */
const COMMON_PASSWORDS = [
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
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return "Bu şifre çok yaygın, farklı bir şifre seçin.";
  }
  return null;
}

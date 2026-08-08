import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/s5/db";
import { S5_COOKIE, signToken, toS5User, type S5UserRow } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { publicRoute } from "@/lib/s5/route";
import { loginSchema } from "@/lib/s5/schemas";

/**
 * Brute-force protection.
 *
 * Attempt counts live in the database rather than in memory: serverless
 * instances do not share memory, so an in-process counter would reset
 * constantly and protect nothing.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** A bcrypt hash of an unguessable value, used to equalise response timing. */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const POST = publicRoute(async (req) => {
  const { username, password } = await parseBody(req, loginSchema);

  const { rows } = await query<S5UserRow>(
    "SELECT * FROM s5_users WHERE username = $1",
    [username.trim().toLowerCase()]
  );
  const account = rows[0];

  // Compare against a dummy hash when the account does not exist so the
  // response time does not reveal which usernames are valid.
  if (!account) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new HttpError(401, "Kullanıcı adı veya şifre hatalı");
  }

  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    const minutesRemaining = Math.ceil(
      (new Date(account.locked_until).getTime() - Date.now()) / 60_000
    );
    throw new HttpError(429, `Çok fazla hatalı deneme. Hesap ${minutesRemaining} dakika kilitli.`);
  }

  const passwordMatches = await bcrypt.compare(password, account.password_hash ?? DUMMY_HASH);

  if (!passwordMatches) {
    const attempts = (account.failed_attempts || 0) + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;

    await recordFailedAttempt(account.id, attempts, shouldLock);

    if (shouldLock) {
      throw new HttpError(
        429,
        `Çok fazla hatalı deneme. Hesap ${LOCK_MINUTES} dakika kilitlendi.`
      );
    }
    throw new HttpError(401, "Kullanıcı adı veya şifre hatalı");
  }

  await resetFailedAttempts(account.id);

  const user = toS5User(account);
  const token = signToken(user);

  const response = NextResponse.json({
    user,
    token,
    must_change_password: account.must_change_password === true,
  });
  response.cookies.set(S5_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
    path: "/",
  });
  return response;
});

/**
 * The lockout columns are added by `supabase/s5-security.sql`. If that
 * migration has not been applied the writes below fail; authentication itself
 * stays correct, so we degrade to "no lockout" and log loudly rather than
 * refusing every login.
 */
async function recordFailedAttempt(userId: string, attempts: number, shouldLock: boolean) {
  try {
    if (shouldLock) {
      await query(
        `UPDATE s5_users
            SET failed_attempts = 0,
                locked_until = now() + ($1 || ' minutes')::interval
          WHERE id = $2`,
        [String(LOCK_MINUTES), userId]
      );
    } else {
      await query("UPDATE s5_users SET failed_attempts = $1 WHERE id = $2", [attempts, userId]);
    }
  } catch (error) {
    console.warn("[s5] brute-force protection is disabled — run supabase/s5-security.sql", error);
  }
}

async function resetFailedAttempts(userId: string) {
  try {
    await query(
      "UPDATE s5_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
      [userId]
    );
  } catch (error) {
    console.warn("[s5] brute-force protection is disabled — run supabase/s5-security.sql", error);
  }
}

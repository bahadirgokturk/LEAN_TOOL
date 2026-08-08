import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/s5/db";
import { validatePassword } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { changePasswordSchema } from "@/lib/s5/schemas";

/**
 * Lets any signed-in user change their own password.
 *
 * Without this endpoint an account flagged `must_change_password` had no way to
 * comply — only an administrator could set passwords.
 */
export const POST = protectedRoute({}, async ({ req, user }) => {
  const { current_password, new_password } = await parseBody(req, changePasswordSchema);

  const { rows } = await query("SELECT password_hash FROM s5_users WHERE id = $1", [user.id]);
  if (!rows[0]) throw new HttpError(404, "Kullanıcı bulunamadı");

  const currentMatches = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!currentMatches) throw new HttpError(401, "Mevcut şifre hatalı");

  const policyError = validatePassword(new_password);
  if (policyError) throw new HttpError(400, policyError);

  const hash = await bcrypt.hash(new_password, 10);
  await query(
    `UPDATE s5_users
        SET password_hash = $1, must_change_password = false,
            failed_attempts = 0, locked_until = NULL
      WHERE id = $2`,
    [hash, user.id]
  );

  return NextResponse.json({ ok: true });
});

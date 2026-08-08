import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/s5/db";
import { normaliseUsername, stripAngleBrackets, validatePassword } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updateUserSchema } from "@/lib/s5/schemas";
import { USER_PUBLIC_COLUMNS } from "@/lib/s5/sql";

export const GET = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rows } = await query(
    `SELECT ${USER_PUBLIC_COLUMNS} FROM s5_users WHERE id=$1`,
    [params.id]
  );
  if (!rows[0]) throw new HttpError(404, "Kullanıcı bulunamadı");
  return NextResponse.json(rows[0]);
});

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin"] },
  async ({ req, user, params }) => {
    const patch = await parseBody(req, updateUserSchema);

    const { rows: existingRows } = await query("SELECT * FROM s5_users WHERE id=$1", [params.id]);
    const existing = existingRows[0];
    if (!existing) throw new HttpError(404, "Kullanıcı bulunamadı");

    // An administrator must not be able to lock themselves out of the system.
    if (params.id === user.id && patch.role && patch.role !== "admin") {
      throw new HttpError(400, "Kendi yönetici yetkinizi kaldıramazsınız.");
    }

    let passwordHash: string | null = null;
    if (patch.password) {
      const policyError = validatePassword(patch.password);
      if (policyError) throw new HttpError(400, policyError);
      passwordHash = await bcrypt.hash(patch.password, 10);
    }

    const username = patch.username !== undefined
      ? normaliseUsername(patch.username)
      : existing.username;
    if (!username) throw new HttpError(400, "Geçersiz kullanıcı adı.");

    // Profile and password are written in a single statement so a failure (for
    // example a duplicate username) cannot leave the password already changed.
    const { rows } = await query(
      `UPDATE s5_users
          SET name=$1, role=$2, dept=$3, fabrika=$4, bolum=$5, username=$6,
              password_hash = COALESCE($7, password_hash),
              must_change_password = CASE WHEN $7 IS NULL THEN must_change_password ELSE false END,
              failed_attempts = CASE WHEN $7 IS NULL THEN failed_attempts ELSE 0 END,
              locked_until = CASE WHEN $7 IS NULL THEN locked_until ELSE NULL END
        WHERE id=$8 RETURNING ${USER_PUBLIC_COLUMNS}`,
      [
        patch.name !== undefined ? stripAngleBrackets(patch.name, 128) : existing.name,
        patch.role ?? existing.role,
        patch.dept !== undefined ? stripAngleBrackets(patch.dept, 128) : existing.dept,
        patch.fabrika !== undefined ? stripAngleBrackets(patch.fabrika, 128) : existing.fabrika,
        patch.bolum !== undefined ? stripAngleBrackets(patch.bolum, 128) : existing.bolum,
        username,
        passwordHash,
        params.id,
      ]
    );
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>(
  { roles: ["admin"] },
  async ({ user, params }) => {
    if (params.id === user.id) {
      throw new HttpError(400, "Kendi hesabınızı silemezsiniz");
    }
    const { rowCount } = await query("DELETE FROM s5_users WHERE id=$1", [params.id]);
    if (!rowCount) throw new HttpError(404, "Kullanıcı bulunamadı");
    return NextResponse.json({ ok: true });
  }
);

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/s5/db";
import { normaliseUsername, stripAngleBrackets, validatePassword } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { createUserSchema } from "@/lib/s5/schemas";
import { USER_PUBLIC_COLUMNS } from "@/lib/s5/sql";

export const GET = protectedRoute({ roles: ["admin"] }, async () => {
  const { rows } = await query(
    `SELECT ${USER_PUBLIC_COLUMNS} FROM s5_users ORDER BY role, name`
  );
  return NextResponse.json(rows);
});

export const POST = protectedRoute({ roles: ["admin"] }, async ({ req }) => {
  const body = await parseBody(req, createUserSchema);

  const policyError = validatePassword(body.password);
  if (policyError) throw new HttpError(400, policyError);

  const username = normaliseUsername(body.username);
  if (!username) throw new HttpError(400, "Geçersiz kullanıcı adı.");

  const hash = await bcrypt.hash(body.password, 10);
  const { rows } = await query(
    `INSERT INTO s5_users (username, password_hash, name, role, dept, fabrika, bolum)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${USER_PUBLIC_COLUMNS}`,
    [
      username,
      hash,
      stripAngleBrackets(body.name, 128),
      body.role,
      stripAngleBrackets(body.dept, 128),
      stripAngleBrackets(body.fabrika, 128),
      stripAngleBrackets(body.bolum, 128),
    ]
  );
  return NextResponse.json(rows[0], { status: 201 });
});

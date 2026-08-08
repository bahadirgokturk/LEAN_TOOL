import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { toS5User, type S5UserRow } from "@/lib/s5/auth";
import { HttpError } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { USER_PUBLIC_COLUMNS } from "@/lib/s5/sql";

/** Returns the signed-in user, re-read from the database rather than the token. */
export const GET = protectedRoute({}, async ({ user }) => {
  const { rows } = await query<S5UserRow>(
    `SELECT ${USER_PUBLIC_COLUMNS} FROM s5_users WHERE id = $1`,
    [user.id]
  );
  if (!rows[0]) throw new HttpError(404, "Kullanıcı bulunamadı");
  return NextResponse.json({ user: toS5User(rows[0]) });
});

import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { protectedRoute } from "@/lib/s5/route";
import { USER_PUBLIC_COLUMNS } from "@/lib/s5/sql";

/** Auditor list, used to populate assignment and audit form dropdowns. */
export const GET = protectedRoute({}, async () => {
  const { rows } = await query(
    `SELECT ${USER_PUBLIC_COLUMNS} FROM s5_users WHERE role='denetci' ORDER BY name`
  );
  return NextResponse.json(rows);
});

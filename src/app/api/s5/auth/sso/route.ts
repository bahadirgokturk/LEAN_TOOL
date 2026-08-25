import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/s5/db";
import { S5_COOKIE, signToken, toS5User, type S5UserRow } from "@/lib/s5/auth";
import { hasApprovedAccess } from "@/lib/auth/access";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  if (!hasApprovedAccess(user)) {
    return NextResponse.json({ error: "Hesabınız henüz onaylanmadı." }, { status: 403 });
  }

  const { rows } = await query<S5UserRow>(
    "SELECT * FROM s5_users WHERE auth_user_id = $1 LIMIT 1",
    [user.id]
  );
  if (!rows[0]) {
    return NextResponse.json(
      { error: "Hesabınıza henüz 5S rolü atanmamış. Yöneticinize başvurun." },
      { status: 403 }
    );
  }

  const s5User = toS5User(rows[0]);
  const response = NextResponse.json({ user: s5User });
  response.cookies.set(S5_COOKIE, signToken(s5User), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
    path: "/",
  });
  return response;
}

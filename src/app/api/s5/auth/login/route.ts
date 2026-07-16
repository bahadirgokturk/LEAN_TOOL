import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/s5/db";
import { S5_COOKIE, signToken, errorResponse, type S5User } from "@/lib/s5/auth";

// POST /api/s5/auth/login
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli" }, { status: 400 });
    }

    const { rows } = await q(
      "SELECT * FROM s5_users WHERE username = $1",
      [String(username).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
    }

    const payload: S5User = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      dept: user.dept,
      fabrika: user.fabrika,
      bolum: user.bolum,
    };
    const token = signToken(payload);

    const res = NextResponse.json({ user: payload, token });
    res.cookies.set(S5_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60, // 8 saat
      path: "/",
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

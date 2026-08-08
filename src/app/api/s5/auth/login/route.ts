import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { q } from "@/lib/s5/db";
import { S5_COOKIE, signToken, errorResponse, type S5User } from "@/lib/s5/auth";

// Brute-force koruması: art arda başarısız denemeden sonra hesap geçici kilitlenir.
// Kilit veritabanında tutulur (serverless'ta bellek örnekler arası paylaşılmaz).
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

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

    // Kullanıcı yoksa da aynı mesaj + benzer süre: hangi kullanıcı adlarının
    // var olduğu sızmasın (user enumeration).
    if (!user) {
      await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid");
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
    }

    // Hesap kilitli mi?
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const dakika = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Çok fazla hatalı deneme. Hesap ${dakika} dakika kilitli.` },
        { status: 429 }
      );
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      // Başarısız denemeyi say; eşiğe ulaşınca kilitle.
      // Not: kilitleme sütunları (s5-security.sql) henüz uygulanmamış olabilir —
      // bu durumda kilitleme atlanır ama giriş akışı çalışmaya devam eder.
      const attempts = (user.failed_attempts || 0) + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      try {
        if (locked) {
          await q(
            `UPDATE s5_users SET failed_attempts = 0,
                    locked_until = now() + ($1 || ' minutes')::interval
              WHERE id = $2`,
            [String(LOCK_MINUTES), user.id]
          );
        } else {
          await q("UPDATE s5_users SET failed_attempts = $1 WHERE id = $2", [attempts, user.id]);
        }
      } catch {
        // Sütunlar yoksa kilitleme devre dışı — kimlik doğrulama yine de güvenli.
      }

      if (locked) {
        return NextResponse.json(
          { error: `Çok fazla hatalı deneme. Hesap ${LOCK_MINUTES} dakika kilitlendi.` },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı" }, { status: 401 });
    }

    // Başarılı giriş — sayaç sıfırlanır.
    try {
      await q(
        "UPDATE s5_users SET failed_attempts = 0, locked_until = NULL WHERE id = $1",
        [user.id]
      );
    } catch {
      // Kilitleme sütunları henüz yoksa sorun değil.
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

    const res = NextResponse.json({
      user: payload,
      token,
      // Varsayılan/zayıf şifreyle giren kullanıcı arayüzde uyarılır.
      must_change_password: user.must_change_password === true,
    });
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

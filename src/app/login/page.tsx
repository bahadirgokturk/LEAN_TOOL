"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";
type Status = "idle" | "loading" | "confirm-sent" | "error";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  marginBottom: 12,
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Supabase auth errors sometimes arrive with an empty/opaque message (e.g. when the
  // SMTP provider rejects the confirmation email). Turn them into something readable.
  function friendlyError(error: { message?: string; status?: number } | null, context: "sign-in" | "sign-up"): string {
    const raw = (error?.message || "").trim();
    if (raw && raw !== "{}") {
      if (/confirmation email|error sending|smtp/i.test(raw))
        return "Doğrulama e-postası gönderilemedi. E-posta ayarları (SMTP) veya alıcı adresi sorunlu olabilir.";
      if (/invalid login credentials/i.test(raw)) return "E-posta veya şifre hatalı.";
      if (/already registered/i.test(raw)) return "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.";
      return raw;
    }
    return context === "sign-up"
      ? "Kayıt tamamlanamadı — doğrulama e-postası gönderilemedi olabilir. Lütfen daha sonra tekrar deneyin."
      : "Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setErrorMessage(friendlyError(error, "sign-in"));
        return;
      }
      router.push("/app");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Stored in raw_user_meta_data → written to the profile by handle_new_user,
        // so the "add member" directory can auto-fill this person's details later.
        data: {
          name: name.trim(),
          surname: surname.trim(),
          department: department.trim(),
          full_name: `${name.trim()} ${surname.trim()}`.trim(),
        },
      },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(friendlyError(error, "sign-up"));
      return;
    }

    // With "Confirm email" turned off in Supabase, signUp() returns an active
    // session immediately — no email round-trip needed. If confirmation gets
    // turned back on later, data.session is null here and we fall back to
    // telling the user to check their inbox.
    if (data.session) {
      router.push("/app");
      return;
    }
    setStatus("confirm-sent");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: 360, padding: 32, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Saueressig OPEX</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
          {mode === "sign-in"
            ? "Proje Yönetim Aracı'na giriş yapmak için e-posta ve şifrenizi girin."
            : "Hesap oluşturmak için e-posta ve şifre belirleyin."}
        </p>

        {status === "confirm-sent" ? (
          <p style={{ fontSize: 14, color: "#065f46", background: "#d1fae5", padding: 12, borderRadius: 8 }}>
            Doğrulama bağlantısı <strong>{email}</strong> adresine gönderildi. Bağlantıya
            tıkladıktan sonra e-posta ve şifrenizle giriş yapabilirsiniz.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" required placeholder="Ad" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                  <input type="text" required placeholder="Soyad" value={surname} onChange={(e) => setSurname(e.target.value)} style={inputStyle} />
                </div>
                <input type="text" placeholder="Departman (örn. OPEX)" value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} />
              </>
            )}
            <input
              type="email"
              required
              placeholder="ad.soyad@saueressig.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: "#4C6285", color: "white", fontWeight: 500, cursor: "pointer" }}
            >
              {status === "loading" ? "..." : mode === "sign-in" ? "Giriş Yap" : "Hesap Oluştur"}
            </button>
            {status === "error" && (
              <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{errorMessage}</p>
            )}
          </form>
        )}

        {status !== "confirm-sent" && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setStatus("idle");
              setErrorMessage("");
            }}
            style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#4C6285", fontSize: 13, cursor: "pointer" }}
          >
            {mode === "sign-in" ? "Hesabınız yok mu? Kayıt olun" : "Zaten hesabınız var mı? Giriş yapın"}
          </button>
        )}
      </div>
    </div>
  );
}

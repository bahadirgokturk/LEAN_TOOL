"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HubBackLink } from "../_components/HubBackLink";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  marginBottom: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  background: "#4C6285",
  color: "white",
  fontWeight: 500,
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#92400e",
  background: "#fffbeb",
  border: "1px solid #fbbf24",
  borderRadius: 8,
  padding: 12,
  margin: "12px 0 16px",
};

/**
 * "Set a new password" screen, reached from the recovery email link.
 *
 * The link establishes a session first (see /auth/confirm). When that session
 * is missing the link was expired, already used, or opened out of order — say
 * so plainly rather than showing a form that cannot succeed.
 */
type SessionState = "checking" | "ready" | "no-session";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setSessionState(data.user ? "ready" : "no-session");
      })
      .catch(() => {
        if (!cancelled) setSessionState("no-session");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    // Mirrors the server-side policy used elsewhere in the platform.
    if (password.length < 8) {
      setErrorMessage("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage("Şifre en az bir harf ve bir rakam içermeli.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMessage(
        "Şifre kaydedilemedi. Sıfırlama bağlantısının süresi dolmuş olabilir, yeni bir bağlantı isteyin."
      );
      return;
    }

    router.push("/app");
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        // Fixed light theme so the page looks identical regardless of the
        // visitor's OS dark-mode preference (globals.css follows the system).
        background: "#f4f6f9",
        color: "#1e2530",
      }}
    >
      <HubBackLink />
      <div style={{ width: 360, padding: 32, border: "1px solid #e5e7eb", borderRadius: 12, background: "#ffffff" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Yeni Şifre Belirle</h1>

        {sessionState === "checking" && (
          <p style={{ fontSize: 14, color: "#6b7280" }}>Bağlantı doğrulanıyor...</p>
        )}

        {sessionState === "no-session" && (
          <>
            <p style={noticeStyle}>
              Bu şifre sıfırlama bağlantısı geçerli değil. Süresi dolmuş, daha önce kullanılmış
              veya doğrudan açılmış olabilir. Giriş sayfasından yeni bir bağlantı isteyin.
            </p>
            <button type="button" onClick={() => router.push("/login")} style={primaryButtonStyle}>
              Giriş sayfasına dön
            </button>
          </>
        )}

        {sessionState === "ready" && (
          <>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
              Hesabınız için yeni bir şifre girin. En az 8 karakter, bir harf ve bir rakam
              içermeli.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Yeni şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Yeni şifre (tekrar)"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? "..." : "Şifreyi Kaydet"}
              </button>
              {errorMessage && (
                <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{errorMessage}</p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}

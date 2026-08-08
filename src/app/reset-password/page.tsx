"use client";

import { useState } from "react";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 6) {
      setErrorMessage("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrorMessage(
        "Şifre kaydedilemedi. Sıfırlama bağlantısının süresi dolmuş olabilir, tekrar deneyin."
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
      }}
    >
      <HubBackLink />
      <div style={{ width: 360, padding: 32, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Yeni Şifre Belirle</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
          Hesabınız için yeni bir şifre girin.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Yeni şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Yeni şifre (tekrar)"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "#4C6285",
              color: "white",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {loading ? "..." : "Şifreyi Kaydet"}
          </button>
          {errorMessage && (
            <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{errorMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";
import { hasApprovedAccess } from "@/lib/auth/access";
import { createGembaClient } from "@/lib/gemba/client";

type Mode = "sign-in" | "sign-up" | "forgot-password";
type Status = "idle" | "loading" | "confirm-sent" | "approval-pending" | "reset-sent" | "error";

/**
 * Messages for the `?error=` parameter set by the email-link callbacks.
 *
 * Without this the callbacks bounced silently to the login page and the user
 * had no idea why their reset link did not work.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  auth_callback_failed:
    "Şifre sıfırlama bağlantısı doğrulanamadı. Bağlantının süresi dolmuş veya daha önce kullanılmış olabilir. Aşağıdan yeni bir bağlantı isteyin.",
  auth_confirm_failed:
    "Bağlantı doğrulanamadı. Süresi dolmuş veya daha önce kullanılmış olabilir. Aşağıdan yeni bir bağlantı isteyin.",
  access_pending:
    "E-posta doğrulandı ancak bu hesap henüz Yalın Tool yöneticisi tarafından onaylanmadı. Onay verilmeden sisteme erişilemez.",
};

/**
 * Reads `?error=` and shows the matching message.
 *
 * Isolated in its own component with a Suspense boundary: `useSearchParams`
 * opts a component out of static prerendering, and confining that to the
 * banner keeps the rest of the form server-rendered.
 */
function CallbackErrorNotice() {
  const searchParams = useSearchParams();
  const message = CALLBACK_ERRORS[searchParams.get("error") ?? ""];
  if (!message) return null;

  return (
    <p
      style={{
        fontSize: 13,
        color: "#92400e",
        background: "#fffbeb",
        border: "1px solid #fbbf24",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}
    >
      {message}
    </p>
  );
}

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

  async function establishModuleSessions(emailAddress: string, userPassword: string) {
    // Gemba operational data still lives in its original Supabase project.
    // Establish that session from the one central form. A missing Gemba role
    // must not block the user from the other Yalın Tool modules.
    const gemba = createGembaClient();
    await gemba.auth.signInWithPassword({ email: emailAddress, password: userPassword });
  }

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

    if (mode === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setStatus("error");
        setErrorMessage(friendlyError(error, "sign-in"));
        return;
      }
      setStatus("reset-sent");
      return;
    }

    if (mode === "sign-in") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setErrorMessage(friendlyError(error, "sign-in"));
        return;
      }
      if (!hasApprovedAccess(data.user)) {
        await supabase.auth.signOut();
        setStatus("approval-pending");
        return;
      }
      await establishModuleSessions(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
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

    // Supabase deliberately obscures an already-registered account by returning
    // a successful response with no identities. Do not falsely promise another
    // confirmation email in that case.
    if (data.user && data.user.identities?.length === 0) {
      setStatus("error");
      setErrorMessage("Bu e-posta daha önce kayıtlı olabilir. Giriş yapın veya şifrenizi sıfırlayın; yeni doğrulama e-postası gönderilmez.");
      return;
    }

    // With "Confirm email" turned off in Supabase, signUp() returns an active
    // session immediately — no email round-trip needed. If confirmation gets
    // turned back on later, data.session is null here and we fall back to
    // telling the user to check their inbox.
    if (data.session) {
      if (!hasApprovedAccess(data.user)) {
        await supabase.auth.signOut();
        setStatus("approval-pending");
        return;
      }
      await establishModuleSessions(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }
    setStatus("confirm-sent");
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.brand}>
          <div className={styles.brandMark}><span className={styles.mark}>O</span> SAUERESSIG OPEX</div>
          <div className={styles.brandCopy}>
            <h2>Yalın dönüşüm, tek çalışma alanı.</h2>
            <p>Kaizen, 5S, Gemba ve operasyon standartlarını güvenli ve ortak bir sistemde yönetin.</p>
          </div>
          <div className={styles.brandFoot}>OPEX LEAN TOOL · TÜRKİYE</div>
        </aside>
        <div className={styles.panel}>
          <div className={styles.formWrap}>
            <p className={styles.eyebrow}>{mode === "sign-in" ? "Tekrar hoş geldiniz" : mode === "forgot-password" ? "Hesap kurtarma" : "Yeni hesap"}</p>
            <h1 className={styles.title}>Saueressig OPEX</h1>
            <p className={styles.description}>
          {mode === "sign-in"
            ? "Yalın Tool çalışma alanına giriş yapın."
            : mode === "forgot-password"
            ? "E-posta adresinize bir şifre sıfırlama bağlantısı gönderelim."
            : "Hesap oluşturmak için e-posta ve şifre belirleyin."}
            </p>

        <Suspense fallback={null}>
          <CallbackErrorNotice />
        </Suspense>

        {mode === "sign-in" && (
          <a className={styles.quickFiveS} href="/5s/index.html">
            <strong>5S Hızlı Giriş</strong>
            <span>E-posta gerekmez · kısa kullanıcı adı ve şifre</span>
          </a>
        )}

        {status === "confirm-sent" ? (
          <p className={styles.success}>
            Doğrulama bağlantısı <strong>{email}</strong> adresine gönderildi. Bağlantıya
            tıkladıktan sonra hesabınız yönetici onayına alınacaktır.
          </p>
        ) : status === "approval-pending" ? (
          <p className={styles.notice}>
            E-posta doğrulaması tek başına erişim sağlamaz. Hesabınız yönetici onayı bekliyor.
          </p>
        ) : status === "reset-sent" ? (
          <p className={styles.success}>
            Şifre sıfırlama bağlantısı <strong>{email}</strong> adresine gönderildi. E-postanızı
            kontrol edin.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <>
                <div className={styles.nameRow}>
                  <label className={styles.field}><span>Ad</span><input className={styles.input} type="text" required value={name} onChange={(e) => setName(e.target.value)} /></label>
                  <label className={styles.field}><span>Soyad</span><input className={styles.input} type="text" required value={surname} onChange={(e) => setSurname(e.target.value)} /></label>
                </div>
                <label className={styles.field}><span>Departman</span><input className={styles.input} type="text" placeholder="Örn. OPEX" value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
              </>
            )}
            <label className={styles.field}><span>E-posta</span><input
              className={styles.input}
              type="email"
              required
              placeholder="ad.soyad@saueressig.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            /></label>
            {mode !== "forgot-password" && (
              <label className={styles.field}><span>Şifre</span><input
                className={styles.input}
                type="password"
                required
                minLength={6}
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              /></label>
            )}
            <button
              className={styles.primary}
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading"
                ? "..."
                : mode === "sign-in"
                ? "Giriş Yap"
                : mode === "forgot-password"
                ? "Sıfırlama Linki Gönder"
                : "Hesap Oluştur"}
            </button>
            {status === "error" && (
              <p className={styles.error}>{errorMessage}</p>
            )}
          </form>
        )}

        <div className={styles.links}>
          {mode === "sign-in" && status !== "confirm-sent" && (
          <button
            className={styles.link}
            type="button"
            onClick={() => {
              setMode("forgot-password");
              setStatus("idle");
              setErrorMessage("");
            }}
          >
            Şifremi unuttum
          </button>
        )}

        {status !== "confirm-sent" && status !== "reset-sent" && (
          <button
            className={styles.link}
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setStatus("idle");
              setErrorMessage("");
            }}
          >
            {mode === "sign-in"
              ? "Hesabınız yok mu? Kayıt olun"
              : mode === "forgot-password"
              ? "Girişe dön"
              : "Zaten hesabınız var mı? Giriş yapın"}
          </button>
        )}
        </div>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import { createGembaClient } from "@/lib/gemba/client";
import { createClient } from "@/lib/supabase/client";
import styles from "../hub.module.css";

export function HubUserMenu({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await Promise.allSettled([
      createClient().auth.signOut(),
      createGembaClient().auth.signOut(),
      fetch("/api/lean-docs/logout", { method: "POST" }),
    ]);
    window.location.replace("/login");
  }

  return (
    <div className={styles.userMenu}>
      <div className={styles.userIdentity}>
        <span>Giriş yapılan hesap</span>
        <strong title={email}>{email}</strong>
      </div>
      <button type="button" onClick={logout} disabled={busy}>
        {busy ? "Çıkış yapılıyor…" : "Çıkış Yap"}
      </button>
    </div>
  );
}

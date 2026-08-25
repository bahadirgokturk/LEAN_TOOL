"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

type AccessUser = { user_id: string; email: string; approved: boolean; requested_at: string };

export default function AccessAdmin() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/access-admin", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error);
    setUsers(value);
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => load().catch((e) => setError(e.message)), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function update(userId: string, approved: boolean) {
    setBusy(userId); setError("");
    try {
      const response = await fetch("/api/access-admin", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approved }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem başarısız."); }
    finally { setBusy(""); }
  }

  return <main className={styles.page}>
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div><span>YÖNETİM</span><h1>Kullanıcı Onayları</h1><p>Yalın Tool erişim taleplerini yönetin.</p></div>
        <a href="/app">Çalışma alanına dön</a>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.list}>
        {users.map((item) => <article className={styles.row} key={item.user_id}>
          <div><strong>{item.email}</strong><small>{new Date(item.requested_at).toLocaleString("tr-TR")}</small></div>
          <button disabled={busy === item.user_id} className={item.approved ? styles.revoke : styles.approve}
            onClick={() => update(item.user_id, !item.approved)}>
            {busy === item.user_id ? "İşleniyor…" : item.approved ? "Erişimi kaldır" : "Onayla"}
          </button>
        </article>)}
        {!users.length && !error && <p>Yükleniyor…</p>}
      </div>
    </section>
  </main>;
}

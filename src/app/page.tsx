import type { Icon } from "@phosphor-icons/react";
import {
  MagnifyingGlass,
  ClipboardText,
  ArrowsClockwise,
  Kanban,
  ChatCircleDots,
  GraduationCap,
  ArrowUpRight,
} from "@phosphor-icons/react/dist/ssr";
import styles from "./hub.module.css";

// ─── Modül URL'leri ──────────────────────────────────────────────────────────
// url: null → henüz deploy edilmedi; buton devre dışı görünür ve kartta
// "URL bekleniyor" notu çıkar. Deploy sonrası buraya gerçek linki yaz, bitti.
const GEMBA_URL = "https://bahadirgokturk.github.io/Gemba_Takip/admin.html";
const FIVE_S_URL: string | null = null; // TODO: 5S deploy edilince ekle (repo: github.com/bahadirgokturk/5s-Denetim)
const KAIZEN_URL: string | null = null; // TODO: Kaizen/BP staging linki gelince ekle
const PM_URL = "https://project-management-one-lemon.vercel.app/login"; // PM'in kendi login sayfası
const KKH_URL: string | null = null; // TODO: Kaizen Know-How (RAG) deploy edilince ekle

type ModuleStatus = "live" | "wip" | "planned";

type Module = {
  title: string;
  subtitle: string;
  status: ModuleStatus;
  url: string | null;
  icon: Icon;
};

const MODULES: Module[] = [
  { title: "Gemba", subtitle: "Nonconformity", status: "live", url: GEMBA_URL, icon: MagnifyingGlass },
  { title: "5S", subtitle: "Denetim", status: "live", url: FIVE_S_URL, icon: ClipboardText },
  { title: "Kaizen", subtitle: "+ Dokümantasyon", status: "wip", url: KAIZEN_URL, icon: ArrowsClockwise },
  { title: "Proje yönetimi", subtitle: "OPEX PM", status: "live", url: PM_URL, icon: Kanban },
  { title: "Kaizen know-how", subtitle: "RAG asistan", status: "wip", url: KKH_URL, icon: ChatCircleDots },
  { title: "Eğitim takip", subtitle: "ve kalifikasyon", status: "planned", url: null, icon: GraduationCap },
];

const BADGE_LABEL: Record<ModuleStatus, string> = {
  live: "Canlı",
  wip: "Devam ediyor",
  planned: "Planlanıyor",
};

const BADGE_CLASS: Record<ModuleStatus, string> = {
  live: styles.badgeLive,
  wip: styles.badgeWip,
  planned: styles.badgePlanned,
};

export default function HubPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>SAUERESSIG TÜRKİYE</p>
        <h1 className={styles.title}>OPEX Lean Tool</h1>
        <p className={styles.subtitle}>Operasyonel mükemmellik modülleri</p>

        <div className={styles.grid}>
          {MODULES.map((mod) => {
            const IconGlyph = mod.icon;
            const inactive = mod.status === "planned" || !mod.url;

            return (
              <div key={mod.title} className={`${styles.card} ${inactive ? styles.cardMuted : ""}`}>
                <div className={styles.cardHead}>
                  <span className={styles.iconBox}>
                    <IconGlyph size={22} weight="duotone" />
                  </span>
                  <span className={`${styles.badge} ${BADGE_CLASS[mod.status]}`}>
                    {BADGE_LABEL[mod.status]}
                  </span>
                </div>

                <h2 className={styles.cardTitle}>{mod.title}</h2>
                <p className={styles.cardSubtitle}>{mod.subtitle}</p>

                {mod.status === "planned" ? (
                  <span className={styles.buttonDisabled}>Planlanıyor</span>
                ) : mod.url ? (
                  <a className={styles.button} href={mod.url} target="_blank" rel="noopener noreferrer">
                    Giriş yap
                    <ArrowUpRight size={14} weight="bold" />
                  </a>
                ) : (
                  <>
                    <span className={styles.buttonDisabled} aria-disabled="true">
                      Giriş yap
                    </span>
                    <p className={styles.placeholderNote}>URL bekleniyor, deploy sonrası eklenecek</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <span>Saueressig Türkiye · OPEX</span>
          <span>{new Date().getFullYear()}</span>
        </footer>
      </div>
    </main>
  );
}

// Faz 2: ortak Supabase Auth projesiyle SSO — şimdilik yapılmadı.
// Bu sayfa Tier 0 (link-out) mimarisidir: backend/auth mantığı yok, her kart
// ilgili uygulamanın kendi login ekranına yönlendirir.

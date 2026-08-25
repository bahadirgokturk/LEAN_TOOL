import type { CSSProperties } from "react";
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
import { createClient } from "@/lib/supabase/server";
import { HubUserMenu } from "./_components/HubUserMenu";

// ─── Module destinations ─────────────────────────────────────────────────────
// Every module now lives inside this application, so these are internal paths
// and open in the same tab. `null` means the module has not been migrated yet;
// its button renders disabled.
const GEMBA_URL = "/gemba/admin.html"; // static pages under public/gemba
const FIVE_S_URL: string | null = "/5s/";
const KAIZEN_URL = "/kaizen";
const PM_URL = "/app";
const KKH_URL: string | null = null; // TODO: add once the RAG assistant ships

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
  { title: "Kaizen", subtitle: "+ Dokümantasyon", status: "live", url: KAIZEN_URL, icon: ArrowsClockwise },
  { title: "Proje yönetimi", subtitle: "OPEX PM", status: "live", url: PM_URL, icon: Kanban },
  { title: "Kaizen know-how", subtitle: "RAG asistan", status: "wip", url: KKH_URL, icon: ChatCircleDots },
  { title: "Eğitim takip", subtitle: "ve kalifikasyon", status: "planned", url: null, icon: GraduationCap },
];

const STATUS_LABEL: Record<ModuleStatus, string> = {
  live: "Canlı",
  wip: "Devam ediyor",
  planned: "Planlanıyor",
};

const STATUS_CLASS: Record<ModuleStatus, string> = {
  live: styles.statusLive,
  wip: styles.statusWip,
  planned: styles.statusPlanned,
};

// Orbital layout: a 720x720 stage, centre (360,360), radius 255. The six
// module nodes start at the top (-90°) and step round in 60° increments.
const STAGE = 720;
const CENTER = STAGE / 2;
const RADIUS = 255;

const NODE_POS = MODULES.map((_, i) => {
  const angle = ((-90 + i * 60) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
});

function OrbitNode({ mod, index }: { mod: Module; index: number }) {
  const IconGlyph = mod.icon;
  const pos = NODE_POS[index];
  const inactive = mod.status === "planned" || !mod.url;
  const delay = { "--d": `${380 + index * 110}ms` } as CSSProperties;
  // Each node drifts at its own tempo and phase; synchronised motion reads as mechanical.
  const float = {
    "--bob-dur": `${4.6 + index * 0.55}s`,
    "--bob-delay": `${index * -1.3}s`,
  } as CSSProperties;

  const body = (
    <>
      <span className={styles.nodeIcon}>
        <IconGlyph size={24} weight="regular" />
      </span>
      <span className={styles.nodeTitle}>{mod.title}</span>
      <span className={styles.nodeSub}>{mod.subtitle}</span>
      <span className={`${styles.nodeStatus} ${STATUS_CLASS[mod.status]}`}>
        {STATUS_LABEL[mod.status]}
      </span>
      {!inactive && (
        <span className={styles.nodeGo}>
          Modülü aç
          <ArrowUpRight size={11} weight="bold" />
        </span>
      )}
    </>
  );

  return (
    <div className={styles.nodeWrap} style={{ left: pos.x, top: pos.y }}>
      <div className={styles.floater} style={float}>
        {inactive ? (
          <div className={`${styles.node} ${styles.nodeMuted}`} style={delay}>
            {body}
          </div>
        ) : (
          <a
            className={styles.node}
            style={delay}
            href={mod.url!}
            tabIndex={-1} /* stage is aria-hidden; the list below is the keyboard path */
          >
            {body}
          </a>
        )}
      </div>
    </div>
  );
}

export default async function HubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className={styles.page}>
      <HubUserMenu email={user?.email ?? "Bilinmeyen hesap"} />
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>SAUERESSIG TÜRKİYE</p>
          <h1 className={styles.title}>OPEX Lean Tool</h1>
          <p className={styles.subtitle}>Operasyonel mükemmellik modülleri</p>
        </header>

        {/* Orbital stage — wide screens only; narrow screens fall back to the list */}
        <div className={styles.stage} aria-hidden="true">
          <svg className={styles.orbitSvg} viewBox={`0 0 ${STAGE} ${STAGE}`}>
            <circle className={styles.orbitRing} cx={CENTER} cy={CENTER} r={RADIUS} />
            {NODE_POS.map((pos, i) => (
              <line
                key={i}
                className={styles.spoke}
                x1={CENTER}
                y1={CENTER}
                x2={pos.x}
                y2={pos.y}
                style={{ "--d": `${250 + i * 90}ms` } as CSSProperties}
              />
            ))}
          </svg>

          <div className={styles.core}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.coreLogo} src="/opex-logo.jpeg" alt="OPEX Lean Tool" />
          </div>

          {MODULES.map((mod, i) => (
            <OrbitNode key={mod.title} mod={mod} index={i} />
          ))}
        </div>

        {/* Detail list — the primary view on mobile, supplementary on desktop */}
        <div className={styles.list}>
          {MODULES.map((mod) => {
            const IconGlyph = mod.icon;
            const inactive = mod.status === "planned" || !mod.url;

            return (
              <div key={mod.title} className={styles.row}>
                <span className={styles.rowIcon}>
                  <IconGlyph size={22} weight="regular" />
                </span>
                <div className={styles.rowBody}>
                  <p className={styles.rowTitle}>{mod.title}</p>
                  <p className={styles.rowSub}>{mod.subtitle}</p>
                  {inactive && mod.status !== "planned" && (
                    <p className={styles.rowNote}>URL bekleniyor, deploy sonrası eklenecek</p>
                  )}
                </div>
                <span className={`${styles.rowStatus} ${STATUS_CLASS[mod.status]}`}>
                  {STATUS_LABEL[mod.status]}
                </span>
                {mod.status === "planned" ? (
                  <span className={styles.rowBtnDisabled}>Planlanıyor</span>
                ) : mod.url ? (
                  <a className={styles.rowBtn} href={mod.url}>
                    Modülü aç
                    <ArrowUpRight size={14} weight="bold" />
                  </a>
                ) : (
                  <span className={styles.rowBtnDisabled} aria-disabled="true">
                    Modülü aç
                  </span>
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

// The app proxy enforces the shared Yalın Tool session before this hub.
// 5S deliberately retains its quick volunteer username/password login.

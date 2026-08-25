/**
 * 5S sign-in, sign-out and role application.
 *
 * This is the TypeScript source of `public/5s/js/auth.js`; that file is built
 * from here (`npm run build:5s`) and must not be edited by hand. It is the
 * first of the browser scripts to be migrated — the rest still ship as plain
 * JavaScript and reach these functions through the globals declared in
 * `globals.d.ts`.
 */

const ROLE_LABELS: Record<S5Role, string> = {
  admin: "👑 Yönetici",
  denetci: "🔍 Denetçi",
  takimlider: "👔 Takım Lideri",
  departman: "🏭 Departman",
};

/** `departman` shares the team-lead styling; it is the same scope of access. */
const ROLE_CLASSES: Record<S5Role, string> = {
  admin: "role-admin",
  denetci: "role-denetci",
  takimlider: "role-takimlider",
  departman: "role-takimlider",
};

/** Roles that may start an audit, and so need the "new audit" shortcut. */
const ROLES_THAT_AUDIT: S5Role[] = ["admin", "denetci"];

const QR_FORM_TYPES = ["uretim", "operasyon", "ofis", "kalite"];

function element<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

async function doLogin(): Promise<void> {
  const username = element<HTMLInputElement>("login-username")?.value.trim() ?? "";
  const password = element<HTMLInputElement>("login-password")?.value ?? "";
  const errorBox = element("login-err");
  const button = element<HTMLButtonElement>("login-btn");
  if (!errorBox || !button) return;

  if (!username || !password) {
    showLoginError(errorBox, "Kullanıcı adı ve şifre girin.");
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>Giriş yapılıyor...';

  try {
    const data = await apiFetch<{ user: S5User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!data) return;
    errorBox.style.display = "none";
    await startSession(data.user);
  } catch (error) {
    showLoginError(errorBox, errorMessage(error) || "Kullanıcı adı veya şifre hatalı!");
  } finally {
    button.disabled = false;
    button.textContent = "Giriş Yap";
  }
}

function showLoginError(errorBox: HTMLElement, message: string): void {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

/**
 * Brings the app up for `user`.
 *
 * Sign-in and a page reload with an existing session both end here, so the
 * order — load data, then paint the role, then honour a QR link — is defined
 * once instead of being repeated in two places that could drift apart.
 */
async function startSession(user: S5User): Promise<void> {
  CURRENT_USER = user;
  await loadAllData();
  applyRole(user);
  handleQRRedirectAfterLogin();
}

async function doLogout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // The session is being dropped locally regardless; a failed call here must
    // not leave the user stuck on a screen they are no longer signed in to.
  }
  CURRENT_USER = null;
  S.audits = [];
  S.areas = [];
  S.actions = [];
  S.users = [];

  const loginScreen = element("login-screen");
  if (loginScreen) {
    loginScreen.style.display = "flex";
    loginScreen.style.opacity = "1";
  }
  const app = element("main-app");
  if (app) app.style.display = "none";

  const username = element<HTMLInputElement>("login-username");
  if (username) username.value = "";
  const password = element<HTMLInputElement>("login-password");
  if (password) password.value = "";
  document.body.className = "";
}

function applyRole(user: S5User): void {
  const loginScreen = element("login-screen");
  if (loginScreen) loginScreen.style.display = "none";
  const app = element("main-app");
  if (app) app.style.display = "flex";

  document.body.className = "role-" + (user.role === "departman" ? "takimlider" : user.role);

  paintUserIdentity(user);
  applyRoleVisibility(user);
  applyAuditorLabels(user);

  const topbarDate = element("topbar-date");
  if (topbarDate) {
    topbarDate.textContent = new Date().toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  navigate("dashboard");
  updateBadges();
}

/** Name and role badge. Written as text, never as markup — `name` is user data. */
function paintUserIdentity(user: S5User): void {
  const label = ROLE_LABELS[user.role] ?? user.role;

  const badge = element("user-badge");
  if (badge) {
    badge.textContent = label;
    badge.className = "role-badge " + ROLE_CLASSES[user.role];
  }

  const sidebarUser = element("sb-user");
  if (!sidebarUser) return;
  sidebarUser.replaceChildren();

  const nameLine = document.createElement("div");
  nameLine.style.cssText = "font-weight:500;color:rgba(255,255,255,.8);";
  nameLine.textContent = user.name;

  const roleLine = document.createElement("div");
  roleLine.style.fontSize = "10px";
  roleLine.textContent = label;

  sidebarUser.append(nameLine, roleLine);
}

/** Shows the menu entries this role is allowed to see, in both navigations. */
function applyRoleVisibility(user: S5User): void {
  document.querySelectorAll<HTMLElement>("#sidebar-nav [data-roles], .bottom-nav [data-roles]").forEach((el) => {
    const roles = (el.getAttribute("data-roles") ?? "").split(" ");
    const allowed =
      roles.includes(user.role) || (user.role === "departman" && roles.includes("takimlider"));
    // Bottom-nav items keep their stylesheet display; sidebar groups are blocks.
    const visibleDisplay = el.classList.contains("bnav-item") ? "" : "block";
    el.style.display = allowed ? visibleDisplay : "none";
  });

  const newAuditButton = document.querySelector<HTMLElement>(".topbar-right .btn-primary");
  if (newAuditButton) {
    newAuditButton.style.display = ROLES_THAT_AUDIT.includes(user.role) ? "" : "none";
  }
}

/** An auditor sees only their own assignments and audits, so the labels say so. */
function applyAuditorLabels(user: S5User): void {
  if (user.role !== "denetci") return;
  const dashboardLabel = element("bnav-dashboard-lbl");
  if (dashboardLabel) dashboardLabel.textContent = "Görevlerim";
  const historyLabel = element("bnav-history-lbl");
  if (historyLabel) historyLabel.textContent = "Denetimlerim";
}

/**
 * Loads everything the signed-in role is allowed to see.
 *
 * The shared lists come first; what follows differs per role, so each role
 * declares its own extra requests rather than the caller guessing.
 */
async function loadAllData(): Promise<void> {
  try {
    const [audits, areas, actions] = await Promise.all([
      apiFetch<S5Audit[]>("/audits?limit=500"),
      apiFetch<S5Area[]>("/areas"),
      apiFetch<Array<Record<string, unknown>>>("/actions"),
    ]);
    if (audits) S.audits = audits;
    if (areas) S.areas = areas;
    if (actions) S.actions = actions;

    if (CURRENT_USER?.role === "admin") {
      await loadAdminData();
    } else {
      await loadNonAdminData();
    }

    // Every role needs the active question set: an auditor fills in the form
    // the administrator chose. GET /forms is not role restricted.
    if (S.formSablonlari === undefined) {
      S.formSablonlari = (await apiFetch<S5FormTemplate[]>("/forms")) ?? [];
    }
    applyActiveTemplate();

    if (CURRENT_USER?.role === "admin") checkSchemaHealth();
  } catch (error) {
    showToast("⚠ Veri yüklenirken hata: " + errorMessage(error));
  }
}

async function loadAdminData(): Promise<void> {
  const [users, plans, forms] = await Promise.all([
    apiFetch<S5User[]>("/users"),
    apiFetch<S5Plan[]>("/audits/plans/list"),
    apiFetch<S5FormTemplate[]>("/forms"),
  ]);
  if (users) S.users = users;
  if (plans) S.atamalar = plans;
  if (forms) S.formSablonlari = forms;
  S.auditors = S.users.filter((user) => user.role === "denetci").map((user) => user.name);
}

async function loadNonAdminData(): Promise<void> {
  if (CURRENT_USER?.role === "denetci") {
    const plans = await apiFetch<S5Plan[]>("/audits/plans/list");
    if (plans) S.atamalar = plans;
  }
  const auditors = await apiFetch<S5User[]>("/users/auditors");
  if (auditors) S.auditors = auditors.map((user) => user.name);
}

type SchemaGap = { table: string; column: string; file: string; impact: string };
type SchemaHealth = { ok: boolean; missing: SchemaGap[]; files: string[] };

/**
 * Warns the administrator about database columns the deployed code expects.
 *
 * Code deploys automatically, `supabase/*.sql` is run by hand, and the gap in
 * between has cost production data twice. Failing loudly here beats a user
 * meeting "Sunucu hatası" halfway through an audit.
 */
async function checkSchemaHealth(): Promise<void> {
  let health: SchemaHealth | null;
  try {
    health = await apiFetch<SchemaHealth>("/health/schema");
  } catch {
    return;
  }
  if (!health || health.ok) return;

  element("schema-warning")?.remove();

  const banner = document.createElement("div");
  banner.id = "schema-warning";
  banner.className = "schema-warning";

  const text = document.createElement("div");
  text.style.flex = "1";
  const heading = document.createElement("b");
  heading.textContent = "⚠ Veritabanı güncellemesi bekliyor.";
  text.append(
    heading,
    ` Supabase SQL Editor üzerinde şu dosyaları çalıştırın: ${health.files.join(", ")}`
  );
  for (const gap of health.missing) {
    const line = document.createElement("div");
    line.textContent = `• ${gap.table}.${gap.column} — ${gap.impact}`;
    text.append(line);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Kapat";
  close.addEventListener("click", () => banner.remove());

  banner.append(text, close);
  document.body.append(banner);
}

/** Restores the session after a page reload. */
async function checkSession(): Promise<boolean> {
  try {
    const data = await apiFetch<{ user: S5User }>("/auth/me");
    if (!data) {
      revealLoginScreen();
      return false;
    }
    await startSession(data.user);
    return true;
  } catch {
    revealLoginScreen();
    return false;
  }
}

function revealLoginScreen(): void {
  const loginScreen = element("login-screen");
  if (loginScreen) loginScreen.style.opacity = "1";
}

/**
 * Opens the audit form when the page was reached from a printed QR code.
 *
 * Two formats are in the field: `?area=<id>` from the original per-area codes,
 * and `?form=<type>` from the current four form-type codes.
 */
function handleQRRedirectAfterLogin(): void {
  const params = new URLSearchParams(window.location.search);

  const areaId = params.get("area");
  if (areaId) {
    const area = S.areas.find((candidate) => candidate.id === areaId);
    if (!area) return;
    window._aktifAtama = { atamaId: null, alanId: area.id, alanAd: area.name };
    consumeQueryString();
    navigate("new-audit");
    return;
  }

  const formType = params.get("form");
  if (formType) {
    if (!QR_FORM_TYPES.includes(formType)) return;
    window._aktifFormTip = formType;
    consumeQueryString();
    navigate("new-audit");
  }
}

/** Drops the QR parameters so a refresh does not restart the same audit. */
function consumeQueryString(): void {
  history.replaceState({}, "", window.location.pathname);
}

/** Points a QR visitor who is not signed in at the login field. */
function checkQRAutostart(): void {
  const params = new URLSearchParams(window.location.search);
  const areaId = params.get("area");
  const formType = params.get("form");
  if (!(areaId || formType) || CURRENT_USER) return;

  element<HTMLInputElement>("login-username")?.focus();
  const label = formType ? FORM_TIP_LABEL[formType] || formType : "Alan";
  showToast("📷 " + label + " QR ile giriş — lütfen oturum açın");
}

declare global {
  interface Window {
    _aktifAtama: { atamaId: string | null; alanId: string; alanAd: string } | null;
    _aktifFormTip: string | null;
  }
}

// The other 5S scripts and the HTML call these by name, so the bundle has to
// put them back on the global object.
Object.assign(globalThis, {
  doLogin,
  doLogout,
  applyRole,
  loadAllData,
  checkSession,
  checkQRAutostart,
  handleQRRedirectAfterLogin,
});

export {};

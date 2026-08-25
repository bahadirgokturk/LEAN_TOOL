// ============================================================
// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: src/5s-client/  ·  Üretmek için: npm run build:5s
// ============================================================
"use strict";
(() => {
  // src/5s-client/auth.ts
  var ROLE_LABELS = {
    admin: "👑 Yönetici",
    denetci: "🔍 Denetçi",
    takimlider: "👔 Takım Lideri",
    departman: "🏭 Departman"
  };
  var ROLE_CLASSES = {
    admin: "role-admin",
    denetci: "role-denetci",
    takimlider: "role-takimlider",
    departman: "role-takimlider"
  };
  var ROLES_THAT_AUDIT = ["admin", "denetci"];
  var QR_FORM_TYPES = ["uretim", "operasyon", "ofis", "kalite"];
  function element(id) {
    return document.getElementById(id);
  }
  async function doLogin() {
    var _a, _b, _c, _d;
    const username = (_b = (_a = element("login-username")) == null ? void 0 : _a.value.trim()) != null ? _b : "";
    const password = (_d = (_c = element("login-password")) == null ? void 0 : _c.value) != null ? _d : "";
    const errorBox = element("login-err");
    const button = element("login-btn");
    if (!errorBox || !button) return;
    if (!username || !password) {
      showLoginError(errorBox, "Kullanıcı adı ve şifre girin.");
      return;
    }
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>Giriş yapılıyor...';
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
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
  function showLoginError(errorBox, message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }
  function errorMessage(error) {
    return error instanceof Error ? error.message : "";
  }
  async function startSession(user) {
    CURRENT_USER = user;
    await loadAllData();
    applyRole(user);
    handleQRRedirectAfterLogin();
  }
  async function doLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
    }
    await fetch("/api/lean-docs/logout", { method: "POST" }).catch(() => void 0);
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
    const username = element("login-username");
    if (username) username.value = "";
    const password = element("login-password");
    if (password) password.value = "";
    document.body.className = "";
    window.location.href = "/login";
  }
  function applyRole(user) {
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
      topbarDate.textContent = (/* @__PURE__ */ new Date()).toLocaleDateString("tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
    navigate("dashboard");
    updateBadges();
  }
  function paintUserIdentity(user) {
    var _a;
    const label = (_a = ROLE_LABELS[user.role]) != null ? _a : user.role;
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
  function applyRoleVisibility(user) {
    document.querySelectorAll("#sidebar-nav [data-roles], .bottom-nav [data-roles]").forEach((el) => {
      var _a;
      const roles = ((_a = el.getAttribute("data-roles")) != null ? _a : "").split(" ");
      const allowed = roles.includes(user.role) || user.role === "departman" && roles.includes("takimlider");
      const visibleDisplay = el.classList.contains("bnav-item") ? "" : "block";
      el.style.display = allowed ? visibleDisplay : "none";
    });
    const newAuditButton = document.querySelector(".topbar-right .btn-primary");
    if (newAuditButton) {
      newAuditButton.style.display = ROLES_THAT_AUDIT.includes(user.role) ? "" : "none";
    }
  }
  function applyAuditorLabels(user) {
    if (user.role !== "denetci") return;
    const dashboardLabel = element("bnav-dashboard-lbl");
    if (dashboardLabel) dashboardLabel.textContent = "Görevlerim";
    const historyLabel = element("bnav-history-lbl");
    if (historyLabel) historyLabel.textContent = "Denetimlerim";
  }
  async function loadAllData() {
    var _a;
    try {
      const [audits, areas, actions] = await Promise.all([
        apiFetch("/audits?limit=500"),
        apiFetch("/areas"),
        apiFetch("/actions")
      ]);
      if (audits) S.audits = audits;
      if (areas) S.areas = areas;
      if (actions) S.actions = actions;
      if ((CURRENT_USER == null ? void 0 : CURRENT_USER.role) === "admin") {
        await loadAdminData();
      } else {
        await loadNonAdminData();
      }
      if (S.formSablonlari === void 0) {
        S.formSablonlari = (_a = await apiFetch("/forms")) != null ? _a : [];
      }
      applyActiveTemplate();
      if ((CURRENT_USER == null ? void 0 : CURRENT_USER.role) === "admin") checkSchemaHealth();
    } catch (error) {
      showToast("⚠ Veri yüklenirken hata: " + errorMessage(error));
    }
  }
  async function loadAdminData() {
    const [users, plans, forms] = await Promise.all([
      apiFetch("/users"),
      apiFetch("/audits/plans/list"),
      apiFetch("/forms")
    ]);
    if (users) S.users = users;
    if (plans) S.atamalar = plans;
    if (forms) S.formSablonlari = forms;
    S.auditors = S.users.filter((user) => user.role === "denetci").map((user) => user.name);
  }
  async function loadNonAdminData() {
    if ((CURRENT_USER == null ? void 0 : CURRENT_USER.role) === "denetci") {
      const plans = await apiFetch("/audits/plans/list");
      if (plans) S.atamalar = plans;
    }
    const auditors = await apiFetch("/users/auditors");
    if (auditors) S.auditors = auditors.map((user) => user.name);
  }
  async function checkSchemaHealth() {
    var _a;
    let health;
    try {
      health = await apiFetch("/health/schema");
    } catch {
      return;
    }
    if (!health || health.ok) return;
    (_a = element("schema-warning")) == null ? void 0 : _a.remove();
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
  async function checkSession() {
    try {
      let response = await fetch("/api/s5/auth/me", { credentials: "include" });
      if (response.status === 401) {
        response = await fetch("/api/s5/auth/sso", {
          method: "POST",
          credentials: "include"
        });
      }
      const data = response.ok ? await response.json() : null;
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
  function revealLoginScreen() {
    const loginScreen = element("login-screen");
    if (loginScreen) loginScreen.style.opacity = "1";
  }
  function handleQRRedirectAfterLogin() {
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
  function consumeQueryString() {
    history.replaceState({}, "", window.location.pathname);
  }
  function checkQRAutostart() {
    var _a;
    const params = new URLSearchParams(window.location.search);
    const areaId = params.get("area");
    const formType = params.get("form");
    if (!(areaId || formType) || CURRENT_USER) return;
    (_a = element("login-username")) == null ? void 0 : _a.focus();
    const label = formType ? FORM_TIP_LABEL[formType] || formType : "Alan";
    showToast("📷 " + label + " QR ile giriş — lütfen oturum açın");
  }
  Object.assign(globalThis, {
    doLogin,
    doLogout,
    applyRole,
    loadAllData,
    checkSession,
    checkQRAutostart,
    handleQRRedirectAfterLogin
  });
})();

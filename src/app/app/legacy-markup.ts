// Auto-generated from the legacy HTML body markup (2026.05.25_ProjectManagementTool.html, lines ~997-2301).
// The PIN-based session screen and the client-side Anthropic API key settings section were
// removed/edited for the Supabase Auth rewrite -- see src/app/app/page.tsx and legacy-app.js.
export const legacyBodyHtml = `
  <!-- LOADING -->
  <div id="loading-screen">
    <div class="loading-logo">PM</div>
    <div class="spinner" style="color: var(--color-primary);"></div>
  </div>

  <!-- SESSION SCREEN — now just an access-resolution / access-denied screen.
       Role is derived from the authenticated Supabase user (project_members / profiles.is_management),
       there is no manual role picker or PIN anymore. -->
  <div id="session-screen" class="hidden">
    <div class="session-card">
      <div class="session-title" id="session-title">Erişim kontrol ediliyor…</div>
      <div class="session-subtitle" id="session-project-name">Lütfen bekleyin.</div>
      <div id="session-status-body">
        <div class="spinner" style="color: var(--color-primary);"></div>
      </div>
      <div class="divider"></div>
      <div style="text-align:center;">
        <button class="btn btn-ghost btn-sm" id="session-back-to-dashboard">← Tüm Projelere Dön</button>
      </div>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast-container"></div>

  <!-- APP SHELL -->
  <div id="app" style="display:none;">

    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div id="sidebar-header">
        <div id="sidebar-logo">PM</div>
        <span id="sidebar-title">Proje Yönetimi</span>
      </div>
      <div id="sidebar-project-section">
        <div class="nav-section-label">Aktif Proje</div>
        <div id="sidebar-project-name">
          <span id="sidebar-project-text">Proje seçilmedi</span>
          <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div id="sidebar-project-dropdown" class="sidebar-proj-dd" style="display:none;"></div>
      </div>
      <nav id="sidebar-nav">
        <div class="nav-section-label">Genel</div>
        <div class="nav-link active" data-view="dashboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Tüm Projeler
        </div>
        <div id="project-nav" style="display:none;">
          <div class="nav-section-label" style="margin-top:8px;">Proje</div>
          <div class="nav-link" data-view="activities">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            Aktiviteler
          </div>
          <div class="nav-link" data-view="gantt">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
            Gantt Şeması
          </div>
          <div class="nav-link" data-view="tracking">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            İzleme
          </div>
          <div class="nav-link" data-view="meetings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            Toplantılar
          </div>
          <div class="nav-link" data-view="actions">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Aksiyonlar
          </div>
          <div class="nav-link" data-view="reports">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Raporlar
          </div>
          <div class="nav-link" data-view="ai">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            AI Asistan
          </div>
          <div class="nav-link" data-view="members">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            Ekip Üyeleri
          </div>
          <div class="nav-link" data-view="settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Proje Ayarları
          </div>
        </div>
      </nav>
      <div id="sidebar-footer">
        <button id="btn-manage-management" type="button" class="btn btn-secondary btn-sm" style="display:none;width:100%;margin-bottom:8px;">
          Yönetim Erişimi
        </button>
        <div id="user-pill">
          <div id="user-avatar">?</div>
          <div id="user-info">
            <div id="user-name">Giriş yapılmadı</div>
            <div id="user-role">—</div>
          </div>
          <button id="btn-sign-out" type="button" title="Yalın Tool'a dön" aria-label="Yalın Tool'a dön">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <div id="main">
      <header id="topbar">
        <div id="topbar-breadcrumb">
          <span id="breadcrumb-project" style="display:none;"></span>
          <span id="breadcrumb-sep" style="display:none;color:var(--color-text-light);">›</span>
          <span id="breadcrumb-view" class="crumb-active">Tüm Projeler</span>
        </div>
        <div id="topbar-actions">
          <button class="btn btn-ghost btn-icon btn-sm" id="topbar-settings-btn" title="Ayarlar" style="display:none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      <div id="content">

        <!-- VIEW: Dashboard -->
        <div id="view-dashboard" class="view active">
          <div class="page-header">
            <div>
              <div class="page-title">Projeler</div>
              <div class="page-subtitle" id="dash-subtitle">Yükleniyor…</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;" title="JSON'dan içe aktar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                JSON İçe Aktar
                <input type="file" id="json-import-input" accept=".json" style="display:none;" />
              </label>
              <button class="btn btn-primary btn-sm" id="btn-new-project">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Yeni Proje
              </button>
            </div>
          </div>
          <div class="dash-toolbar">
            <div class="filter-pills" id="dash-filter-pills">
              <button class="filter-pill active" data-filter="all">Tümü</button>
              <button class="filter-pill" data-filter="active">Aktif</button>
              <button class="filter-pill" data-filter="draft">Taslak</button>
              <button class="filter-pill" data-filter="on_hold">Beklemede</button>
              <button class="filter-pill" data-filter="completed">Tamamlandı</button>
              <button class="filter-pill" data-filter="cancelled">İptal</button>
            </div>
          </div>
          <div id="project-grid" class="project-grid"></div>
          <div id="dash-empty" class="empty-state" style="display:none;">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            <div class="empty-state-title" id="dash-empty-title">Henüz proje yok</div>
            <div class="empty-state-desc" id="dash-empty-desc">Yeni bir proje oluşturun veya mevcut bir projeyi JSON olarak içe aktarın.</div>
            <button class="btn btn-primary" id="btn-new-project-empty">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Proje Oluştur
            </button>
          </div>
        </div>

        <!-- WIZARD MODAL -->
        <div id="wizard-overlay" class="modal-overlay">
          <div class="modal modal-lg">
            <div class="modal-header">
              <div class="modal-title">Yeni Proje Oluştur</div>
              <button class="modal-close btn" id="wizard-close-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="wizard-steps" id="wizard-step-indicator">
                <div class="wizard-step active" data-step="1"><div class="step-bubble">1</div><span class="step-label">Proje Detayları</span></div>
                <div class="wizard-step" data-step="2"><div class="step-bubble">2</div><span class="step-label">Ekip Kurulumu</span></div>
                <div class="wizard-step" data-step="3"><div class="step-bubble">3</div><span class="step-label">Özet &amp; Oluştur</span></div>
              </div>

              <!-- Step 1 -->
              <div id="wiz-step-1" class="wiz-step-panel">
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Proje Adı <span class="required">*</span></label>
                    <input type="text" id="wiz-name" class="form-control" placeholder="örn. ERP Dönüşüm Projesi" maxlength="120" />
                    <div class="form-error" id="err-wiz-name"></div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Proje Kodu <span class="required">*</span></label>
                    <input type="text" id="wiz-code" class="form-control" placeholder="örn. ERP-2026" maxlength="20" />
                    <div class="form-hint">Benzersiz olmalı. Addan otomatik önerilir.</div>
                    <div class="form-error" id="err-wiz-code"></div>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Açıklama</label>
                  <textarea id="wiz-desc" class="form-control" placeholder="Proje hakkında kısa bir açıklama…" rows="3"></textarea>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Başlangıç Tarihi <span class="required">*</span></label>
                    <input type="date" id="wiz-start" class="form-control" />
                    <div class="form-error" id="err-wiz-start"></div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Bitiş Tarihi <span class="required">*</span></label>
                    <input type="date" id="wiz-end" class="form-control" />
                    <div class="form-error" id="err-wiz-end"></div>
                  </div>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Bütçe</label>
                    <input type="number" id="wiz-budget" class="form-control" placeholder="0" min="0" step="1000" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Para Birimi</label>
                    <select id="wiz-currency" class="form-control">
                      <option value="TRY">TRY — Türk Lirası</option>
                      <option value="USD">USD — ABD Doları</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Step 2 -->
              <div id="wiz-step-2" class="wiz-step-panel" style="display:none;">
                <div class="alert alert-info">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  En az 1 ekip üyesi ve 1 PM rolü zorunludur.
                </div>
                <div id="wiz-members-list"></div>
                <div id="member-add-form">
                  <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);margin-bottom:12px;">Ekip Üyesi Ekle</div>
                  <div class="form-group" style="margin-bottom:10px;">
                    <label class="form-label">Kayıtlı kullanıcıdan seç (opsiyonel)</label>
                    <select id="wiz-member-directory" class="form-control"><option value="">— Elle gir veya listeden seç —</option></select>
                    <div class="form-hint">Seçince ad, soyad, departman ve e-posta otomatik dolar.</div>
                  </div>
                  <div class="form-row form-row-2">
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">Ad <span class="required">*</span></label>
                      <input type="text" id="mem-name" class="form-control" placeholder="Ad" />
                    </div>
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">Soyad <span class="required">*</span></label>
                      <input type="text" id="mem-surname" class="form-control" placeholder="Soyad" />
                    </div>
                  </div>
                  <div class="form-row form-row-2">
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">Departman</label>
                      <input type="text" id="mem-dept" class="form-control" placeholder="örn. Yazılım" />
                    </div>
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">Rol <span class="required">*</span></label>
                      <select id="mem-role" class="form-control">
                        <option value="member">Ekip Üyesi</option>
                        <option value="pm">Proje Yöneticisi</option>
                      </select>
                    </div>
                  </div>
                  <div class="form-row form-row-2">
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">E-posta</label>
                      <input type="email" id="mem-email" class="form-control" placeholder="ad@sirket.com" />
                    </div>
                    <div class="form-group" style="margin-bottom:10px;">
                      <label class="form-label">Günlük Kapasite (saat)</label>
                      <input type="number" id="mem-capacity" class="form-control" value="8" min="1" max="24" />
                    </div>
                  </div>
                  <div class="form-error" id="err-wiz-member" style="margin-bottom:8px;"></div>
                  <button class="btn btn-secondary btn-sm" id="btn-add-member">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Listeye Ekle
                  </button>
                </div>
                <div class="form-error" id="err-wiz-team" style="margin-top:10px;"></div>
              </div>

              <!-- Step 3 -->
              <div id="wiz-step-3" class="wiz-step-panel" style="display:none;">
                <div class="alert alert-success">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Her şey hazır. Özeti kontrol edip projeyi oluşturun.
                </div>
                <div class="summary-section">
                  <div class="summary-section-title">Proje Bilgileri</div>
                  <div class="summary-grid" id="sum-project-fields"></div>
                </div>
                <div class="summary-section">
                  <div class="summary-section-title">Ekip Üyeleri (<span id="sum-member-count">0</span>)</div>
                  <div class="summary-members-list" id="sum-members-list"></div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" id="wiz-back-btn" style="margin-right:auto;display:none;">← Geri</button>
              <button class="btn btn-secondary" id="wiz-cancel-btn">İptal</button>
              <button class="btn btn-primary" id="wiz-next-btn">Devam Et →</button>
            </div>
          </div>
        </div>

        <!-- MANAGEMENT ACCESS MODAL (visible only to existing management users) -->
        <div id="management-modal-overlay" class="modal-overlay">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title">Yönetim Erişimi</div>
              <button class="modal-close btn" id="management-modal-close-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-hint" style="margin-bottom:12px;">
                Departman yönetimi (Genel Müdür, Genel Müdür Yardımcısı, Süpervizör vb.) için tüm projeleri salt-okunur görebilme yetkisi verir/kaldırır. Kişinin sisteme en az bir kez giriş yapmış (hesap oluşturmuş) olması gerekir.
              </div>
              <div class="form-group">
                <label class="form-label">E-posta</label>
                <input type="email" id="mgmt-email" class="form-control" placeholder="ad.soyad@saueressig.com" />
              </div>
              <div class="form-group">
                <label class="form-label">Erişim</label>
                <select id="mgmt-flag" class="form-control">
                  <option value="true">Yönetim erişimi ver</option>
                  <option value="false">Yönetim erişimini kaldır</option>
                </select>
              </div>
              <div class="form-error" id="err-mgmt"></div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" id="mgmt-cancel-btn">İptal</button>
              <button class="btn btn-primary" id="mgmt-save-btn">Kaydet</button>
            </div>
          </div>
        </div>

        <!-- VIEW: Activities -->
        <div id="view-activities" class="view">

          <!-- MAIN PANE -->
          <div id="act-main-pane">
            <!-- Toolbar -->
            <div class="act-toolbar">
              <div class="act-toolbar-title" id="act-toolbar-title">Aktiviteler</div>
              <button class="btn btn-ghost btn-sm" id="btn-collapse-all" title="Tümünü Daralt">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm" id="btn-expand-all" title="Tümünü Genişlet">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div style="width:1px;height:20px;background:var(--color-border);margin:0 2px;"></div>
              <button class="btn btn-ghost btn-sm" id="btn-auto-wbs" style="display:none;" title="WBS kodlarını gruplara ve sıraya göre otomatik yeniden numaralandır">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                WBS Otomatik
              </button>
              <button class="btn btn-secondary btn-sm" id="btn-add-group" style="display:none;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Grup Ekle
              </button>
              <button class="btn btn-primary btn-sm" id="btn-add-activity" style="display:none;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Aktivite Ekle
              </button>
            </div>

            <!-- Bulk action bar -->
            <div class="bulk-bar" id="act-bulk-bar">
              <span class="bulk-count" id="bulk-count-txt">0 seçili</span>
              <span style="color:var(--color-text-muted);font-size:var(--font-size-xs);">Toplu durum:</span>
              <select id="bulk-status-select" class="form-control" style="width:auto;padding:3px 8px;font-size:var(--font-size-xs);">
                <option value="">— Seç —</option>
                <option value="not_started">Başlamadı</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="on_hold">Beklemede</option>
                <option value="cancelled">İptal</option>
              </select>
              <button class="btn btn-primary btn-sm" id="btn-bulk-apply">Uygula</button>
              <button class="btn btn-ghost btn-sm" id="btn-bulk-clear">Temizle</button>
            </div>

            <!-- CPM Critical Path Legend -->
            <div id="cpm-legend" class="hidden">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <strong>Kritik Yol aktif</strong> — kırmızı kenarlıklı aktiviteler float=0 (gecikme toleransı yok).
              <span style="margin-left:auto;color:var(--color-text-muted);">Bağımlılıklar değiştirildiğinde otomatik güncellenir.</span>
            </div>


            <!-- WBS Tree table -->
            <div id="act-tree-wrap">
              <table class="wbs-table" id="wbs-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" id="select-all-cb" class="act-cb" /></th>
                    <th style="min-width:260px;">Ad / WBS Kodu</th>
                    <th style="min-width:90px;">Atananlar</th>
                    <th style="min-width:90px;">Başlangıç</th>
                    <th style="min-width:90px;">Bitiş</th>
                    <th style="min-width:60px;">Süre</th>
                    <th style="min-width:100px;">Durum</th>
                    <th style="min-width:100px;">Tamamlanma</th>
                    <th style="min-width:80px;">Maliyet</th>
                    <th style="width:40px;"></th>
                  </tr>
                </thead>
                <tbody id="wbs-tbody">
                  <tr><td colspan="10"><div class="wbs-empty">Yükleniyor…</div></td></tr>
                </tbody>
              </table>
            </div>
          </div><!-- /#act-main-pane -->

          <!-- DETAIL PANE (Step 2.3) -->
          <div id="act-detail-pane">
            <div id="act-pane-header">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);" id="dpane-title">Aktivite Detayı</div>
                <button class="btn btn-ghost btn-icon btn-sm" id="btn-close-detail">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);" id="dpane-subtitle"></div>
            </div>
            <div id="act-pane-body">
              <input type="hidden" id="dp-activity-id" />

              <!-- 5.7 AI Suggest Panel -->
              <div id="ai-suggest-panel">
                <div class="ai-suggest-header">
                  <span>✨</span> AI Önerileri
                  <button type="button" class="btn btn-ghost btn-icon btn-sm ai-suggest-dismiss" id="btn-ai-suggest-dismiss" title="Kapat">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div id="ai-suggest-content"></div>
              </div>

              <!-- Basic info -->
              <div class="detail-section">
                <div class="detail-section-title">Temel Bilgiler</div>
                <div class="form-group">
                  <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                    <span>Aktivite Adı <span class="required">*</span></span>
                    <button type="button" class="btn btn-ghost btn-sm" id="btn-ai-suggest-activity" style="font-size:11px;padding:2px 8px;display:none;">✨ AI Öner</button>
                  </label>
                  <input type="text" id="dp-name" class="form-control" placeholder="Aktivite adı" maxlength="200" />
                  <div class="form-error" id="err-dp-name"></div>
                </div>
                <div class="form-group">
                  <label class="form-label">Grup</label>
                  <select id="dp-group" class="form-control"></select>
                  <div class="form-hint">WBS kodu gruba ve sıraya göre otomatik atanır.</div>
                </div>
                <div class="form-group">
                  <label class="form-label">Açıklama</label>
                  <textarea id="dp-desc" class="form-control" rows="2" placeholder="Opsiyonel notlar…"></textarea>
                </div>
              </div>

              <!-- Dates & Duration -->
              <div class="detail-section">
                <div class="detail-section-title">Tarihler &amp; Süre</div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Başlangıç</label>
                    <input type="date" id="dp-start" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Bitiş</label>
                    <input type="date" id="dp-end" class="form-control" />
                  </div>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Süre (iş günü)</label>
                    <input type="number" id="dp-duration" class="form-control" min="0" placeholder="0" />
                    <div class="form-hint">Tarihlerden otomatik hesaplanır.</div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tamamlanma %</label>
                    <div class="pct-slider-row">
                      <input type="range" id="dp-pct-slider" class="pct-slider" min="0" max="100" step="5" value="0" />
                      <span class="pct-slider-val" id="dp-pct-val">0%</span>
                    </div>
                    <input type="number" id="dp-pct" class="form-control" min="0" max="100" step="5" value="0" style="margin-top:6px;" />
                  </div>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Baz. Başlangıç</label>
                    <input type="date" id="dp-base-start" class="form-control" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Baz. Bitiş</label>
                    <input type="date" id="dp-base-end" class="form-control" />
                  </div>
                </div>
              </div>

              <!-- Status & Priority -->
              <div class="detail-section">
                <div class="detail-section-title">Durum &amp; Öncelik</div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select id="dp-status" class="form-control">
                      <option value="not_started">Başlamadı</option>
                      <option value="in_progress">Devam Ediyor</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="on_hold">Beklemede</option>
                      <option value="cancelled">İptal Edildi</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Öncelik</label>
                    <select id="dp-priority" class="form-control">
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                      <option value="critical">Kritik</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Dönüm Noktası</label>
                  <div class="milestone-toggle">
                    <label class="toggle-switch">
                      <input type="checkbox" id="dp-milestone" />
                      <span class="toggle-track"></span>
                    </label>
                    <span style="font-size:var(--font-size-sm);color:var(--color-text-muted);">Bu aktivite bir milestone'dur</span>
                  </div>
                </div>
              </div>

              <!-- Assignees -->
              <div class="detail-section">
                <div class="detail-section-title">Atananlar</div>
                <div class="assignee-select-list" id="dp-assignees-list">
                  <div style="color:var(--color-text-muted);font-size:var(--font-size-xs);padding:4px;">Yükleniyor…</div>
                </div>
              </div>

              <!-- Cost -->
              <div class="detail-section">
                <div class="detail-section-title">Maliyet</div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Planlanan</label>
                    <input type="number" id="dp-cost-planned" class="form-control" min="0" step="100" placeholder="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Gerçekleşen</label>
                    <input type="number" id="dp-cost-actual" class="form-control" min="0" step="100" placeholder="0" />
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div class="detail-section">
                <div class="detail-section-title">Notlar</div>
                <textarea id="dp-notes" class="form-control" rows="3" placeholder="Serbest metin notlar…"></textarea>
              </div>

              <!-- Dependencies (Step 2.4) -->
              <div class="detail-section" id="dp-dep-section">
                <div class="detail-section-title">Önceki Aktiviteler (Bağımlılıklar)</div>
                <div id="dp-dep-list"></div>
                <div class="dep-add-form" id="dp-dep-add-form">
                  <div class="form-group" style="flex:1;min-width:140px;">
                    <label class="form-label" style="font-size:11px;">Önceki Aktivite</label>
                    <select id="dp-dep-pred" class="form-control"></select>
                  </div>
                  <div class="form-group" style="width:80px;">
                    <label class="form-label" style="font-size:11px;">Tip</label>
                    <select id="dp-dep-type" class="form-control">
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                      <option value="FF">FF</option>
                      <option value="SF">SF</option>
                    </select>
                  </div>
                  <div class="form-group" style="width:68px;">
                    <label class="form-label" style="font-size:11px;">Gecikme (gün)</label>
                    <input type="number" id="dp-dep-lag" class="form-control" value="0" step="1" />
                  </div>
                  <div class="form-group" style="padding-top:18px;">
                    <button class="btn btn-secondary btn-sm" id="btn-dep-add">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Ekle
                    </button>
                  </div>
                  <span id="err-dep" style="display:none;"></span>
                </div>
              </div>


              <div class="form-error" id="err-dp-general" style="margin-bottom:8px;"></div>
            </div><!-- /#act-pane-body -->
            <div id="act-pane-footer">
              <button class="btn btn-danger btn-sm" id="btn-delete-activity" style="margin-right:8px;display:none;" title="Aktiviteyi kalıcı olarak sil">Sil</button>
              <button class="btn btn-secondary btn-sm" id="btn-cancel-activity" style="margin-right:auto;display:none;" title="Aktiviteyi iptal et (silmez, iptal durumuna alır)">İptal Et</button>
              <button class="btn btn-ghost btn-sm" id="btn-close-detail-footer">Kapat</button>
              <button class="btn btn-primary btn-sm" id="btn-save-activity">Kaydet</button>
            </div>
          </div><!-- /#act-detail-pane -->

        </div><!-- /#view-activities -->

        <!-- GROUP MODAL -->
        <div id="group-modal-overlay">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-title" id="group-modal-title">Grup Ekle</div>
              <button class="btn modal-close" id="group-modal-close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Grup Adı <span class="required">*</span></label>
                <input type="text" id="gm-name" class="form-control" placeholder="örn. Tasarım Aşaması" maxlength="80" />
                <div class="form-error" id="err-gm-name"></div>
              </div>
              <div class="form-group">
                <label class="form-label">Üst Grup</label>
                <select id="gm-parent" class="form-control">
                  <option value="">— Kök seviye —</option>
                </select>
                <div class="form-hint">WBS kodu hiyerarşiye göre otomatik atanır.</div>
              </div>
              <div class="form-group">
                <label class="form-label">Renk</label>
                <div class="color-swatch-row" id="gm-color-row"></div>
                <input type="hidden" id="gm-color" value="#2563EB" />
              </div>
              <input type="hidden" id="gm-editing-id" value="" />
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" id="gm-cancel-btn">İptal</button>
              <button class="btn btn-primary" id="gm-save-btn">Kaydet</button>
            </div>
          </div>
        </div>
        <!-- VIEW: Gantt -->
        <div id="view-gantt" class="view">

          <!-- Gantt Toolbar -->
          <div class="gantt-toolbar">
            <div class="gantt-toolbar-title" id="gantt-title">Gantt Şeması</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-xs);color:var(--color-text-muted);">
              <span class="row-dot" style="width:8px;height:8px;border-radius:50%;background:var(--color-danger);display:inline-block;"></span>Kritik Yol
              <span class="row-dot" style="width:8px;height:8px;border-radius:2px;background:var(--color-neutral);display:inline-block;margin-left:8px;"></span>Baz Plan
              <span style="width:2px;height:16px;background:var(--color-border);margin:0 6px;display:inline-block;"></span>
              <span style="color:var(--color-danger);font-weight:600;">▏</span>Bugün
            </div>
            <div class="timescale-group">
              <button class="timescale-btn" data-scale="day">Gün</button>
              <button class="timescale-btn active" data-scale="week">Hafta</button>
              <button class="timescale-btn" data-scale="month">Ay</button>
            </div>
          </div>

          <!-- Gantt Body -->
          <div class="gantt-body" id="gantt-body">
            <!-- Left: Activity list labels -->
            <div class="gantt-list-pane" id="gantt-list-pane">
              <div class="gantt-list-header">Aktivite</div>
              <div id="gantt-list-rows"></div>
            </div>
            <!-- Right: SVG timeline -->
            <div class="gantt-timeline-pane" id="gantt-timeline-pane">
              <div id="gantt-svg-wrap">
                <svg id="gantt-svg" xmlns="http://www.w3.org/2000/svg"></svg>
              </div>
              <div class="gantt-empty" id="gantt-empty" style="display:none;">
                <h3>Aktivite Yok</h3>
                <p>Gantt şeması için aktivite ekleyin ve tarih belirleyin.</p>
              </div>
            </div>
          </div>

          <!-- Tooltip -->
          <div id="gantt-tooltip"></div>

        </div><!-- /#view-gantt -->
        <!-- VIEW: Tracking -->
        <div id="view-tracking" class="view">
          <!-- TRACKING & MONITORING — Phase 3 -->
          <div class="tracking-scroll">

            <!-- Header -->
            <div class="tracking-header">
              <div class="tracking-title" id="tracking-title">Proje İzleme</div>
              <div class="tracking-subtitle" id="tracking-subtitle">Proje ilerlemesi, gecikmeler, maliyet ve iş yükü analizi.</div>
            </div>

            <!-- 3.1 Summary Cards (left) + Status counts (top-right) -->
            <div class="tracking-overview">
              <div class="summary-cards" id="summary-cards">
                <!-- Rendered by JS -->
              </div>
              <div class="status-count-grid" id="status-count-grid">
                <!-- Rendered by JS -->
              </div>
            </div>

            <!-- MEMBER-ONLY: own tasks, no cost/workload/reports (see renderTrackingView) -->
            <div class="tracking-section" id="section-my-tasks" style="display:none;">
              <div class="tracking-section-header">
                <span class="tracking-section-title">Görevlerim</span>
              </div>
              <div class="tracking-section-body">
                <div style="margin-bottom:18px;">
                  <div style="font-size:13px;font-weight:600;color:var(--color-danger);margin-bottom:6px;">Geciken</div>
                  <table class="tracking-table">
                    <thead><tr><th>Aktivite</th><th>Planlanan Bitiş</th><th>Gecikme</th><th>Durum</th></tr></thead>
                    <tbody id="my-delayed-tbody"></tbody>
                  </table>
                </div>
                <div style="margin-bottom:18px;">
                  <div style="font-size:13px;font-weight:600;color:var(--color-primary);margin-bottom:6px;">Devam Eden</div>
                  <table class="tracking-table">
                    <thead><tr><th>Aktivite</th><th>Başlangıç</th><th>Bitiş</th><th>Tamamlanma</th></tr></thead>
                    <tbody id="my-inprogress-tbody"></tbody>
                  </table>
                </div>
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--color-text-muted);margin-bottom:6px;">Başlamayan</div>
                  <table class="tracking-table">
                    <thead><tr><th>Aktivite</th><th>Planlanan Başlangıç</th><th>Planlanan Bitiş</th></tr></thead>
                    <tbody id="my-notstarted-tbody"></tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- 3.2 Delay & Risk -->
            <div class="tracking-section" id="section-delayed">
              <div class="tracking-section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span class="tracking-section-title">Geciken Aktiviteler</span>
                <span class="tracking-section-badge badge-danger" id="badge-delayed">0</span>
              </div>
              <div class="tracking-section-body">
                <table class="tracking-table">
                  <thead><tr>
                    <th>Aktivite</th><th>Atanan</th><th>Planlanan Bitiş</th><th>Gecikme</th><th>Durum</th>
                  </tr></thead>
                  <tbody id="delayed-tbody"></tbody>
                </table>
              </div>
            </div>

            <div class="tracking-section" id="section-atrisk">
              <div class="tracking-section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span class="tracking-section-title">Risk Altındaki Aktiviteler <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);">(≤3 iş günü kaldı)</span></span>
                <span class="tracking-section-badge badge-warning" id="badge-atrisk">0</span>
              </div>
              <div class="tracking-section-body">
                <table class="tracking-table">
                  <thead><tr>
                    <th>Aktivite</th><th>Atanan</th><th>Planlanan Bitiş</th><th>Kalan Gün</th><th>Tamamlanma</th>
                  </tr></thead>
                  <tbody id="atrisk-tbody"></tbody>
                </table>
              </div>
            </div>

            <div class="tracking-section" id="section-upcoming">
              <div class="tracking-section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span class="tracking-section-title">Yaklaşan Aktiviteler <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);">(7 iş günü içinde başlayacak)</span></span>
                <span class="tracking-section-badge badge-primary" id="badge-upcoming">0</span>
              </div>
              <div class="tracking-section-body">
                <table class="tracking-table">
                  <thead><tr>
                    <th>Aktivite</th><th>Atanan</th><th>Başlangıç</th><th>Bitiş</th><th>Durum</th>
                  </tr></thead>
                  <tbody id="upcoming-tbody"></tbody>
                </table>
              </div>
            </div>

            <!-- 3.3 Cost Tracking -->
            <div class="tracking-section" id="section-cost">
              <div class="tracking-section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                <span class="tracking-section-title">Maliyet Takibi</span>
              </div>
              <!-- KPI row -->
              <div class="cost-summary-row" id="cost-kpi-row"></div>
              <!-- Budget bar chart -->
              <div class="budget-chart-wrap">
                <div class="budget-chart-label">Bütçe Kullanımı</div>
                <svg id="budget-svg" height="60"></svg>
              </div>
              <!-- Group cost table -->
              <div class="tracking-section-body">
                <table class="cost-group-table">
                  <thead><tr>
                    <th>Grup</th><th>Planlanan</th><th>Gerçekleşen</th><th>Sapma</th><th>Kullanım</th>
                  </tr></thead>
                  <tbody id="cost-group-tbody"></tbody>
                </table>
              </div>
            </div>

            <!-- 3.4 Workload -->
            <div class="tracking-section" id="section-workload">
              <div class="tracking-section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span class="tracking-section-title">İş Yükü &amp; Kapasite Analizi</span>
              </div>
              <!-- Workload bar chart -->
              <div class="workload-chart-wrap">
                <div class="workload-chart-label">Üye Başına Toplam Aktivite İş Günü</div>
                <svg id="workload-svg" height="160"></svg>
              </div>
              <!-- Member table -->
              <div class="tracking-section-body">
                <table class="workload-member-table">
                  <thead><tr>
                    <th>Üye</th><th>Departman</th><th>Aktivite Sayısı</th><th>Toplam İş Günü</th><th>Kapasite Kullanımı</th><th>Durum</th>
                  </tr></thead>
                  <tbody id="workload-member-tbody"></tbody>
                </table>
              </div>
            </div>

          </div><!-- /tracking-scroll -->
        </div>
        <!-- VIEW: Meetings -->
        <div id="view-meetings" class="view">
          <!-- Toolbar -->
          <div class="p4-toolbar">
            <span class="p4-toolbar-title" id="meetings-toolbar-title">Toplantılar</span>
            <button class="btn btn-primary btn-sm" id="btn-new-meeting" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Toplantı
            </button>
          </div>
          <!-- Content -->
          <div class="p4-scroll" id="meetings-content">
            <div class="meeting-grid" id="meeting-grid"></div>
          </div>

          <!-- Meeting Modal (create/edit) -->
          <div class="modal-overlay" id="meeting-modal-overlay">
            <div class="modal" id="meeting-modal">
              <div class="modal-header">
                <span class="modal-title" id="meeting-modal-title">Yeni Toplantı</span>
                <button class="btn btn-ghost btn-icon" id="meeting-modal-close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="modal-body">
                <input type="hidden" id="mm-meeting-id" />

                <!-- Tabs -->
                <div class="meeting-tabs">
                  <div class="meeting-tab active" data-tab="mm-tab-details">Detaylar</div>
                  <div class="meeting-tab" data-tab="mm-tab-agenda">Gündem</div>
                  <div class="meeting-tab" data-tab="mm-tab-notes">Notlar</div>
                </div>

                <!-- Tab: Details -->
                <div class="meeting-tab-panel active" id="mm-tab-details">
                  <div class="form-group">
                    <label class="form-label">Toplantı Başlığı <span class="required">*</span></label>
                    <input type="text" class="form-input" id="mm-title" placeholder="Toplantı başlığını girin" />
                  </div>
                  <div class="form-row form-row-2">
                    <div class="form-group">
                      <label class="form-label">Tarih &amp; Saat</label>
                      <input type="datetime-local" class="form-input" id="mm-date" />
                    </div>
                    <div class="form-group">
                      <label class="form-label">Lokasyon</label>
                      <input type="text" class="form-input" id="mm-location" placeholder="Oda adı veya link" />
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select class="form-input" id="mm-status">
                      <option value="planned">Planlandı</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal Edildi</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Katılımcılar</label>
                    <div style="display:flex;gap:8px;margin-bottom:6px;">
                      <select class="form-input" id="mm-attendee-select" style="flex:1;">
                        <option value="">— Üye seçin —</option>
                      </select>
                      <button type="button" class="btn btn-secondary btn-sm" id="btn-mm-add-attendee">Ekle</button>
                    </div>
                    <div class="attendee-tags" id="mm-attendee-tags"></div>
                  </div>
                </div>

                <!-- Tab: Agenda -->
                <div class="meeting-tab-panel" id="mm-tab-agenda">
                  <div class="agenda-list" id="mm-agenda-list"></div>
                  <div class="agenda-add-row" id="mm-agenda-add-row">
                    <input type="text" class="form-input" id="mm-agenda-topic" placeholder="Gündem maddesi" />
                    <input type="number" class="form-input" id="mm-agenda-dur" placeholder="dk" min="1" />
                    <select class="form-input" id="mm-agenda-presenter">
                      <option value="">— Sunan —</option>
                    </select>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-mm-add-agenda">Ekle</button>
                  </div>
                </div>

                <!-- Tab: Notes -->
                <div class="meeting-tab-panel" id="mm-tab-notes">
                  <div class="form-group">
                    <label class="form-label">Toplantı Notları</label>
                    <textarea class="form-input" id="mm-notes" rows="7" placeholder="Toplantı notlarını buraya girin…" style="resize:vertical;"></textarea>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Bu Toplantıdan Aksiyonlar</label>
                    <div id="mm-actions-list" style="font-size:13px;color:var(--color-text-muted);">Kaydedildikten sonra aksiyon ekleyebilirsiniz.</div>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-mm-add-action" style="margin-top:8px;display:none;">+ Aksiyon Ekle</button>
                  </div>
                  <!-- 5.5 AI Summarize -->
                  <div id="mm-ai-summarize-wrap" style="display:none;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                      <label class="form-label" style="margin:0;">AI Özet &amp; Aksiyon Önerileri</label>
                      <button type="button" class="btn btn-primary btn-sm" id="btn-mm-ai-summarize">
                        ✨ AI ile Özetle
                      </button>
                    </div>
                    <div id="mm-ai-summarize-result"></div>
                    <div class="ai-proposals-list" id="mm-ai-proposals"></div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-ghost" id="mm-cancel-btn">İptal</button>
                <button class="btn btn-danger btn-sm" id="mm-delete-btn" style="display:none;margin-right:auto;">Sil</button>
                <button class="btn btn-primary" id="mm-save-btn">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
        <!-- VIEW: Actions -->
        <div id="view-actions" class="view">
          <!-- Toolbar -->
          <div class="p4-toolbar">
            <span class="p4-toolbar-title" id="actions-toolbar-title">Aksiyonlar</span>
            <div id="action-filter-bar">
              <button class="action-filter-btn active" data-filter="all">Tümü</button>
              <button class="action-filter-btn" data-filter="open">Açık</button>
              <button class="action-filter-btn" data-filter="overdue">Gecikmiş</button>
              <button class="action-filter-btn" data-filter="in_progress">Devam Ediyor</button>
              <button class="action-filter-btn" data-filter="completed">Tamamlandı</button>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-new-action" style="display:none;margin-left:auto;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Aksiyon
            </button>
          </div>
          <!-- Content -->
          <div class="p4-scroll">
            <div class="action-list" id="action-list"></div>
          </div>

          <!-- Action Modal -->
          <div class="modal-overlay" id="action-modal-overlay">
            <div class="modal" id="action-modal">
              <div class="modal-header">
                <span class="modal-title" id="action-modal-title">Yeni Aksiyon</span>
                <button class="btn btn-ghost btn-icon" id="action-modal-close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="modal-body">
                <input type="hidden" id="am-action-id" />
                <input type="hidden" id="am-meeting-id" />
                <div class="form-group">
                  <label class="form-label">Başlık <span class="required">*</span></label>
                  <input type="text" class="form-input" id="am-title" placeholder="Aksiyon başlığı" />
                </div>
                <div class="form-group">
                  <label class="form-label">Açıklama</label>
                  <textarea class="form-input" id="am-description" rows="3" placeholder="Detaylar…"></textarea>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Atanan Kişi <span class="required">*</span></label>
                    <select class="form-input" id="am-assignee">
                      <option value="">— Üye seçin —</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Bitiş Tarihi</label>
                    <input type="date" class="form-input" id="am-due-date" />
                  </div>
                </div>
                <div class="form-row form-row-2">
                  <div class="form-group">
                    <label class="form-label">Öncelik</label>
                    <select class="form-input" id="am-priority">
                      <option value="high">Yüksek</option>
                      <option value="medium" selected>Orta</option>
                      <option value="low">Düşük</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Durum</label>
                    <select class="form-input" id="am-status">
                      <option value="open">Açık</option>
                      <option value="in_progress">Devam Ediyor</option>
                      <option value="completed">Tamamlandı</option>
                      <option value="cancelled">İptal Edildi</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">İlgili Aktivite <span style="font-weight:400;color:var(--color-text-muted);">(opsiyonel)</span></label>
                  <select class="form-input" id="am-related-activity">
                    <option value="">— Aktivite seçin —</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-ghost" id="am-cancel-btn">İptal</button>
                <button class="btn btn-danger btn-sm" id="am-delete-btn" style="display:none;margin-right:auto;">Sil</button>
                <button class="btn btn-primary" id="am-save-btn">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
        <!-- VIEW: Reports (numeric/visual analytics dashboard) -->
        <div id="view-reports" class="view">
          <div class="p4-toolbar">
            <span class="p4-toolbar-title" id="reports-toolbar-title">Raporlar</span>
            <span id="reports-updated" style="font-size:12px;color:var(--color-text-muted);"></span>
          </div>
          <div class="ai-scroll" id="reports-content"></div>
        </div>
        <!-- VIEW: AI -->
        <div id="view-ai" class="view">
          <!-- Toolbar -->
          <div class="p4-toolbar">
            <span class="p4-toolbar-title" id="ai-toolbar-title">AI Asistan</span>
            <span id="ai-api-status-chip" style="font-size:12px;"></span>
          </div>
          <div class="ai-scroll">

            <!-- No API key warning -->
            <div class="ai-no-key-notice" id="ai-no-key-notice" style="display:none;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="2" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>AI modüllerini kullanmak için önce <a id="ai-goto-settings">Proje Ayarları</a> ekranından Anthropic API anahtarınızı girin.</span>
            </div>

            <!-- Module cards -->
            <div class="ai-modules-grid">
              <!-- 5.3 Risk Report -->
              <div class="ai-module-card">
                <div class="ai-module-card-header">
                  <div class="ai-module-icon ai-module-icon-risk">🔴</div>
                  <div class="ai-module-info">
                    <div class="ai-module-title">Risk &amp; Gecikme Raporu</div>
                    <div class="ai-module-desc">Geciken ve risk altındaki aktiviteleri analiz eder. Kritik etki analizi ve önerilen aksiyonları listeler.</div>
                  </div>
                </div>
                <div class="ai-module-footer">
                  <span class="ai-last-run" id="ai-risk-last-run">Henüz çalıştırılmadı</span>
                  <button class="btn btn-primary btn-sm" id="btn-ai-risk" disabled>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Raporu Oluştur
                  </button>
                </div>
              </div>

              <!-- 5.4 Workload Analysis -->
              <div class="ai-module-card">
                <div class="ai-module-card-header">
                  <div class="ai-module-icon ai-module-icon-workload">📊</div>
                  <div class="ai-module-info">
                    <div class="ai-module-title">İş Yükü &amp; Kaynak Analizi</div>
                    <div class="ai-module-desc">Ekip üyelerinin kapasitelerini ve atanan aktiviteleri analiz eder. Aşırı yük uyarıları ve yeniden dağılım önerileri üretir.</div>
                  </div>
                </div>
                <div class="ai-module-footer">
                  <span class="ai-last-run" id="ai-workload-last-run">Henüz çalıştırılmadı</span>
                  <button class="btn btn-primary btn-sm" id="btn-ai-workload" disabled>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Analizi Çalıştır
                  </button>
                </div>
              </div>
              <!-- 5.6 Weekly Report -->
              <div class="ai-module-card">
                <div class="ai-module-card-header">
                  <div class="ai-module-icon ai-module-icon-weekly">📋</div>
                  <div class="ai-module-info">
                    <div class="ai-module-title">Haftalık Durum Raporu</div>
                    <div class="ai-module-desc">Yönetim için kısa özet + detaylı aktivite durumu + riskler + gelecek hafta planı. Kopyalanabilir düz metin.</div>
                  </div>
                </div>
                <div class="ai-module-footer">
                  <span class="ai-last-run" id="ai-weekly-last-run">Henüz çalıştırılmadı</span>
                  <button class="btn btn-primary btn-sm" id="btn-ai-weekly" disabled>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Raporu Oluştur
                  </button>
                </div>
              </div>
            </div>

            <!-- Active result panel -->
            <div id="ai-result-container" style="display:none;"></div>

            <!-- Weekly report copy modal (inline) -->
            <div class="modal-overlay" id="weekly-report-modal-overlay">
              <div class="modal" id="weekly-report-modal">
                <div class="modal-header">
                  <span class="modal-title">Haftalık Durum Raporu</span>
                  <button class="btn btn-ghost btn-icon" id="weekly-report-modal-close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div class="modal-body">
                  <div class="weekly-report-body" id="weekly-report-content"></div>
                  <div class="copy-btn-wrap">
                    <span class="copy-success" id="copy-success-msg">✓ Kopyalandı!</span>
                    <button class="btn btn-primary btn-sm" id="btn-copy-weekly-report">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      Kopyala
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Log history -->
            <div id="ai-log-section">
              <div class="ai-section-title">AI Geçmiş Kayıtları</div>
              <div class="ai-log-filters" id="ai-log-filters">
                <button class="ai-log-filter-btn active" data-log-filter="all">Tümü</button>
                <button class="ai-log-filter-btn" data-log-filter="risk_report">Risk Raporu</button>
                <button class="ai-log-filter-btn" data-log-filter="workload_analysis">İş Yükü</button>
                <button class="ai-log-filter-btn" data-log-filter="weekly_report">Haftalık Rapor</button>
                <button class="ai-log-filter-btn" data-log-filter="meeting_summary">Toplantı Özeti</button>
                <button class="ai-log-filter-btn" data-log-filter="activity_suggestion">Aktivite Öneri</button>
              </div>
              <div class="ai-log-list" id="ai-log-list"></div>
            </div>

          </div>
        </div>
        <!-- VIEW: Members (Step 1.5) -->
        <div id="view-members" class="view">
          <div class="page-header">
            <div>
              <div class="page-title">Ekip Üyeleri</div>
              <div class="page-subtitle" id="members-subtitle">Projenin ekip üyelerini yönetin.</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-add-member-view" style="display:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Üye Ekle
            </button>
          </div>
          <!-- PM-only lock overlay shown for non-PM add actions -->
          <div style="position:relative;">
            <!-- Member table -->
            <div class="members-table-wrap">
              <table id="members-table">
                <thead>
                  <tr>
                    <th style="width:36px;"></th>
                    <th>Ad Soyad</th>
                    <th>Departman</th>
                    <th>Rol</th>
                    <th>Kapasite (saat/gün)</th>
                    <th>E-posta</th>
                    <th style="width:80px;"></th>
                  </tr>
                </thead>
                <tbody id="members-tbody">
                  <tr><td colspan="7" style="text-align:center;padding:32px;color:var(--color-text-muted);">Yükleniyor…</td></tr>
                </tbody>
              </table>
            </div>
            <!-- Inline add/edit form -->
            <div id="member-form-panel" class="member-edit-form" style="display:none;">
              <div class="member-edit-form-title" id="member-form-title">Yeni Üye Ekle</div>
              <div class="form-group" id="mf-directory-group" style="margin-bottom:10px;">
                <label class="form-label">Kayıtlı kullanıcıdan seç (opsiyonel)</label>
                <select id="mf-directory" class="form-control"><option value="">— Elle gir veya listeden seç —</option></select>
                <div class="form-hint">Seçince ad, soyad, departman ve e-posta otomatik dolar.</div>
              </div>
              <div class="form-row form-row-3">
                <div class="form-group">
                  <label class="form-label">Ad <span class="required">*</span></label>
                  <input type="text" id="mf-name" class="form-control" placeholder="Ad" />
                </div>
                <div class="form-group">
                  <label class="form-label">Soyad <span class="required">*</span></label>
                  <input type="text" id="mf-surname" class="form-control" placeholder="Soyad" />
                </div>
                <div class="form-group">
                  <label class="form-label">Departman</label>
                  <input type="text" id="mf-dept" class="form-control" placeholder="örn. Yazılım" />
                </div>
              </div>
              <div class="form-row form-row-3">
                <div class="form-group">
                  <label class="form-label">Rol <span class="required">*</span></label>
                  <select id="mf-role" class="form-control">
                    <option value="member">Ekip Üyesi</option>
                    <option value="pm">Proje Yöneticisi</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Günlük Kapasite (saat)</label>
                  <input type="number" id="mf-capacity" class="form-control" value="8" min="1" max="24" />
                </div>
                <div class="form-group">
                  <label class="form-label">E-posta</label>
                  <input type="email" id="mf-email" class="form-control" placeholder="ad@sirket.com" />
                </div>
              </div>
              <div class="form-error" id="err-mf" style="margin-bottom:10px;"></div>
              <input type="hidden" id="mf-editing-id" value="" />
              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" id="mf-save-btn">Kaydet</button>
                <button class="btn btn-ghost btn-sm" id="mf-cancel-btn">İptal</button>
              </div>
            </div>
          </div>
        </div>

        <!-- VIEW: Settings (Step 1.7) -->
        <div id="view-settings" class="view">
          <div class="page-header">
            <div>
              <div class="page-title">Proje Ayarları</div>
              <div class="page-subtitle">Proje detaylarını düzenleyin.</div>
            </div>
          </div>
          <!-- PM lock notice -->
          <div id="settings-pm-notice" class="alert alert-warning" style="display:none;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Proje ayarlarını düzenlemek için Proje Yöneticisi (PM) rolüyle giriş yapmalısınız.
          </div>
          <div class="settings-section">
            <div class="settings-section-title">Proje Bilgileri</div>
            <div class="form-row form-row-2">
              <div class="form-group">
                <label class="form-label">Proje Adı <span class="required">*</span></label>
                <input type="text" id="set-name" class="form-control" placeholder="Proje adı" maxlength="120" />
              </div>
              <div class="form-group">
                <label class="form-label">Proje Kodu</label>
                <input type="text" id="set-code" class="form-control" disabled />
                <div class="form-hint">Proje kodu oluşturulduktan sonra değiştirilemez.</div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Açıklama</label>
              <textarea id="set-desc" class="form-control" rows="3" placeholder="Proje açıklaması…"></textarea>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group">
                <label class="form-label">Başlangıç Tarihi <span class="required">*</span></label>
                <input type="date" id="set-start" class="form-control" />
              </div>
              <div class="form-group">
                <label class="form-label">Bitiş Tarihi <span class="required">*</span></label>
                <input type="date" id="set-end" class="form-control" />
                <div class="form-error" id="err-set-end"></div>
              </div>
            </div>
            <div class="form-row form-row-3">
              <div class="form-group">
                <label class="form-label">Bütçe</label>
                <input type="number" id="set-budget" class="form-control" min="0" step="1000" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Para Birimi</label>
                <select id="set-currency" class="form-control">
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Durum</label>
                <select id="set-status" class="form-control">
                  <option value="draft">Taslak</option>
                  <option value="active">Aktif</option>
                  <option value="on_hold">Beklemede</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
            </div>
            <div class="form-error" id="err-settings" style="margin-bottom:10px;"></div>
            <button class="btn btn-primary" id="btn-save-settings">Değişiklikleri Kaydet</button>
          </div>

          <!-- AI & API key section removed: the Anthropic key now lives server-side only
               (see src/app/api/ai/route.ts). AI features are gated by PM role, not a client key. -->

          <div class="settings-section danger-zone">
            <div class="settings-section-title">Tehlikeli Bölge</div>
            <div class="danger-action">
              <div class="danger-action-info">
                <h4>Projeyi Sil</h4>
                <p>Bu işlem geri alınamaz. Tüm aktiviteler, toplantılar, aksiyonlar ve ekip bilgileri kalıcı olarak silinir.</p>
              </div>
              <button class="btn btn-danger btn-sm" id="btn-delete-project-settings">Projeyi Sil</button>
            </div>
          </div>
        </div>

      </div><!-- /#content -->
    </div><!-- /#main -->
  </div><!-- /#app -->
`;

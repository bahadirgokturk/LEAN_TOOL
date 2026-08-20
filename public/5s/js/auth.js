// ============================================================
// auth.js — Login, logout, applyRole, token yönetimi
// ============================================================

async function doLogin(){
  const un = document.getElementById('login-username').value.trim();
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');

  if(!un || !pw){ errEl.textContent='Kullanıcı adı ve şifre girin.'; errEl.style.display='block'; return; }

  btn.disabled=true;
  btn.innerHTML='<span class="spinner"></span>Giriş yapılıyor...';

  try {
    const data = await apiFetch('/auth/login', {
      method:'POST',
      body: JSON.stringify({ username:un, password:pw }),
    });
    if(!data) return;
    errEl.style.display='none';
    CURRENT_USER = data.user;
    await loadAllData();
    applyRole(data.user);
    handleQRRedirectAfterLogin();
  } catch(err){
    errEl.textContent = err.message || 'Kullanıcı adı veya şifre hatalı!';
    errEl.style.display='block';
  } finally {
    btn.disabled=false;
    btn.textContent='Giriş Yap';
  }
}

async function doLogout(){
  try { await apiFetch('/auth/logout', { method:'POST' }); } catch(e){}
  CURRENT_USER = null;
  S.audits=[]; S.areas=[]; S.actions=[]; S.users=[];
  const ls = document.getElementById('login-screen');
  ls.style.display='flex'; ls.style.opacity='1';
  document.getElementById('main-app').style.display='none';
  document.getElementById('login-username').value='';
  document.getElementById('login-password').value='';
  document.body.className='';
}

function applyRole(user){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('main-app').style.display='flex';
  document.body.className='role-'+(user.role==='departman'?'takimlider':user.role);

  const roleLabels={admin:'👑 Yönetici',denetci:'🔍 Denetçi',takimlider:'👔 Takım Lideri',departman:'🏭 Departman'};
  const roleClasses={admin:'role-admin',denetci:'role-denetci',takimlider:'role-takimlider',departman:'role-takimlider'};
  const badge=document.getElementById('user-badge');
  if(badge){ badge.textContent=roleLabels[user.role]||user.role; badge.className='role-badge '+roleClasses[user.role]; }
  const sbUser=document.getElementById('sb-user');
  if(sbUser) sbUser.innerHTML=`<div style="font-weight:500;color:rgba(255,255,255,.8);">${user.name}</div><div style="font-size:10px;">${roleLabels[user.role]}</div>`;

  // Yan menu ve alt menu ayni data-roles sozlesmesini kullanir.
  document.querySelectorAll('#sidebar-nav [data-roles], .bottom-nav [data-roles]').forEach(el=>{
    const roles=el.getAttribute('data-roles').split(' ');
    const match=roles.includes(user.role)||(user.role==='departman'&&roles.includes('takimlider'));
    const gorunum=el.classList.contains('bnav-item')?'':'block';
    el.style.display=match?gorunum:'none';
  });

  // Denetci icin etiketler gorev odakli: sadece kendi atamalari ve denetimleri.
  if(user.role==='denetci'){
    const dashLbl=document.getElementById('bnav-dashboard-lbl');
    if(dashLbl) dashLbl.textContent='Görevlerim';
    const histLbl=document.getElementById('bnav-history-lbl');
    if(histLbl) histLbl.textContent='Denetimlerim';
  }

  const newAuditBtn=document.querySelector('.topbar-right .btn-primary');
  if(newAuditBtn) newAuditBtn.style.display=(user.role==='takimlider'||user.role==='departman')?'none':'';

  document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  navigate('dashboard');
  updateBadges();
}

// ── Tüm veriyi API'den yükle ──────────────────────────────────
async function loadAllData(){
  try {
    const [audits, areas, actions] = await Promise.all([
      apiFetch('/audits?limit=500'),
      apiFetch('/areas'),
      apiFetch('/actions'),
    ]);
    if(audits)  S.audits  = audits;
    if(areas)   S.areas   = areas;
    if(actions) S.actions = actions;

    // Denetçi listesi (admin + denetci rolü)
    if(CURRENT_USER?.role==='admin'){
      const [users, plans, forms] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/audits/plans/list'),
        apiFetch('/forms'),
      ]);
      if(users) S.users = users;
      if(plans) S.atamalar = plans;
      if(forms) S.formSablonlari = forms;
      S.auditors = S.users.filter(u=>u.role==='denetci').map(u=>u.name);
    } else if(CURRENT_USER?.role==='denetci'){
      const plans = await apiFetch('/audits/plans/list');
      if(plans) S.atamalar = plans;
      const auds = await apiFetch('/users/auditors');
      if(auds) S.auditors = auds.map(u=>u.name);
    } else {
      const auds = await apiFetch('/users/auditors');
      if(auds) S.auditors = auds.map(u=>u.name);
    }

    // Aktif form şablonu TÜM roller için gerekli: denetçi de admin'in seçtiği
    // özel soru setiyle denetim yapmalı. GET /forms rol kısıtlı değildir.
    if(S.formSablonlari === undefined){
      const forms = await apiFetch('/forms');
      S.formSablonlari = forms || [];
    }
    applyActiveTemplate();
    if(CURRENT_USER?.role==='admin') checkSchemaHealth();
  } catch(err){
    showToast('⚠ Veri yüklenirken hata: ' + err.message);
  }
}

// ── Veritabanı şema kontrolü ─────────────────────────────────
// Kod Vercel'e otomatik dağıtılır, supabase/*.sql dosyaları ise elle çalıştırılır.
// Arada kalan sürede yeni kolonu kullanan işlem "Sunucu hatası" verir; bu daha
// önce iki kez üretimde veri kaybettirdi. Eksik kolon varsa yöneticiye söylenir.
async function checkSchemaHealth(){
  let health;
  try { health = await apiFetch('/health/schema'); } catch { return; }
  if(!health || health.ok) return;

  const existing = document.getElementById('schema-warning');
  if(existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'schema-warning';
  banner.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#8e2020;color:#fff;'
    + 'padding:12px 16px;font-size:12px;line-height:1.5;display:flex;gap:12px;align-items:flex-start;';
  const items = health.missing.map(m=>'• '+m.table+'.'+m.column+' — '+m.impact).join('<br>');
  banner.innerHTML = '<div style="flex:1;">'
    + '<b>⚠ Veritabanı güncellemesi bekliyor.</b> Supabase SQL Editor üzerinde şu dosyaları çalıştırın: <b>'
    + health.files.join(', ') + '</b><br>' + items
    + '</div><button style="background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:6px;'
    + 'padding:6px 10px;cursor:pointer;" onclick="this.parentElement.remove()">Kapat</button>';
  document.body.appendChild(banner);
}

// ── Oturum kontrolü (sayfa yenileme) ────────────────────────
async function checkSession(){
  try {
    const data = await apiFetch('/auth/me');
    if(!data){
      // Oturum yok — login ekranını göster
      const ls = document.getElementById('login-screen');
      if(ls) ls.style.opacity = '1';
      return false;
    }
    CURRENT_USER = data.user;
    await loadAllData();
    applyRole(data.user);
    handleQRRedirectAfterLogin();
    return true;
  } catch(e){
    // Hata durumunda da login ekranını göster
    const ls = document.getElementById('login-screen');
    if(ls) ls.style.opacity = '1';
    return false;
  }
}

// ── QR yönlendirme ────────────────────────────────────────────
function handleQRRedirectAfterLogin(){
  const params = new URLSearchParams(window.location.search);
  const qrArea = params.get('area');  // eski format: ?area=id
  const qrForm = params.get('form');  // yeni format: ?form=uretim

  if(qrArea){
    // Eski alan bazlı QR — geriye uyumluluk
    const area = S.areas.find(a=>a.id===qrArea);
    if(!area) return;
    window._aktifAtama = { atamaId:null, alanId:area.id, alanAd:area.name };
    history.replaceState({}, '', window.location.pathname);
    navigate('new-audit');
  } else if(qrForm){
    // Yeni 4-tip QR sistemi
    const gecerliTipler = ['uretim','operasyon','ofis','kalite'];
    if(!gecerliTipler.includes(qrForm)) return;
    window._aktifFormTip = qrForm;
    history.replaceState({}, '', window.location.pathname);
    navigate('new-audit');
  }
}

function checkQRAutostart(){
  const params = new URLSearchParams(window.location.search);
  const qrArea = params.get('area');
  const qrForm = params.get('form');
  if((qrArea || qrForm) && !CURRENT_USER){
    const el=document.getElementById('login-username');
    if(el) el.focus();
    const tipAdi = qrForm ? (FORM_TIP_LABEL[qrForm]||qrForm) : 'Alan';
    showToast('📷 ' + tipAdi + ' QR ile giriş — lütfen oturum açın');
  }
}

// ============================================================
// audit.js — Denetim formu, soru yapılandırma, kaydetme
// ============================================================

// _editAuditId — app.js'de tanımlı (global state)

// ── Form yardımcıları ─────────────────────────────────────────
function _setAuditorDisplay(name){
  const av=document.getElementById('auditor-avatar');
  const disp=document.getElementById('auditor-display');
  if(av){ const ini=name.split(' ').map(n=>n[0]||'').join('').substring(0,2).toUpperCase(); av.textContent=ini; }
  if(disp) disp.textContent=name;
}

function _showAreaQRCard(area){
  const card=document.getElementById('area-qr-card');
  const sel=document.getElementById('audit-area');
  const nameEl=document.getElementById('area-qr-name');
  const subEl=document.getElementById('area-qr-sub');
  if(card){ card.style.display='flex'; }
  if(sel)  sel.style.display='none';
  if(nameEl) nameEl.textContent=area.name||'—';
  if(subEl)  subEl.textContent=[area.fabrika, area.dept, area.alt_dept].filter(Boolean).join(' · ');
}

function _hideAreaQRCard(){
  const card=document.getElementById('area-qr-card');
  const sel=document.getElementById('audit-area');
  if(card) card.style.display='none';
  if(sel)  sel.style.display='block';
}

function clearAreaQR(){
  _hideAreaQRCard();
  const sel=document.getElementById('audit-area');
  if(sel) sel.value='';
}

function onAuditAreaChange(){
  const sel=document.getElementById('audit-area');
  const areaId=sel?.value;
  const area=S.areas.find(a=>a.id===areaId);
  const locEl=document.getElementById('audit-location');
  if(locEl) locEl.value=area?.fabrika||'';
}

function editAudit(id){
  _editAuditId = id;
  // navigate() _editAuditId'yi null'a sıfırlar — onun yerine doğrudan sayfayı aktifleştir
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  const target = document.getElementById('page-new-audit');
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(x=>{ if(x.getAttribute('onclick')?.includes("'new-audit'")) x.classList.add('active'); });
  const titleEl = document.getElementById('topbar-title');
  if(titleEl) titleEl.textContent = 'Denetim Düzenle';
  closeSidebar();
  initForm();
}

function initForm(){
  const role = CURRENT_USER?.role||'denetci';
  const adminView    = document.getElementById('admin-audit-view');
  const denetciView  = document.getElementById('denetci-audit-view');

  if(role==='admin' && !_editAuditId){
    if(adminView)   adminView.style.display='block';
    if(denetciView) denetciView.style.display='none';
    const tarihEl = document.getElementById('admin-ata-tarih');
    if(tarihEl) tarihEl.value = new Date().toISOString().split('T')[0];
    _renderDenetciKartlari();
    _renderBolgeListesi();
    _renderFormSablonDropdown();
    renderAdminBekleyenList();
    return;
  }

  if(adminView)   adminView.style.display='none';
  if(denetciView) denetciView.style.display='block';

  // Alan dropdown
  const allAreas = S.areas;
  const sel = document.getElementById('audit-area');
  sel.innerHTML = '<option value="">Alan seçiniz...</option>';
  sel.onchange = onAuditAreaChange;
  const fabMap={};
  // Admin düzenleme modunda tüm alanları çek (backend admin için hepsini döner)
  allAreas.forEach(a=>{ const f=a.fabrika||'Genel'; if(!fabMap[f]) fabMap[f]={}; const ad=a.alt_dept||a.dept||'Diğer'; if(!fabMap[f][ad]) fabMap[f][ad]=[]; fabMap[f][ad].push(a); });
  Object.entries(fabMap).forEach(([fab,adMap])=>{
    const og=document.createElement('optgroup'); og.label='🏭 '+fab; sel.appendChild(og);
    Object.entries(adMap).forEach(([ad,areas])=>{
      areas.forEach(a=>{ const opt=document.createElement('option'); opt.value=a.id; opt.textContent=ad+' › '+a.name; og.appendChild(opt); });
    });
  });

  // Düzenleme modu banner'ı
  const editBanner = document.getElementById('audit-edit-banner');

  // Mevcut denetimi yükle (düzenleme modu)
  if(_editAuditId){
    const existingAudit = S.audits.find(a=>a.id===_editAuditId);
    if(!existingAudit){ showToast('⚠ Denetim bulunamadı'); _editAuditId=null; return; }

    if(editBanner){
      editBanner.style.display='flex';
      editBanner.innerHTML=`<span>✏️ <b>Düzenleme Modu</b> — ${existingAudit.area_name} · ${existingAudit.date}</span><button class="btn btn-sm btn-outline" onclick="_editAuditId=null;initForm()">✕ İptal</button>`;
    }

    // Başlık alanlarını doldur
    document.getElementById('audit-form-code').value = existingAudit.form_code||'';
    document.getElementById('audit-date').value = existingAudit.date||'';
    const shiftEl=document.getElementById('audit-shift'); if(shiftEl) shiftEl.value=existingAudit.shift||'Sabah';
    const locEl=document.getElementById('audit-location'); if(locEl) locEl.value=existingAudit.location||'';
    const tlEl=document.getElementById('audit-team-leader'); if(tlEl) tlEl.value=existingAudit.team_leader||'';

    // Alan seç
    if(existingAudit.area_id) sel.value=existingAudit.area_id;

    // Denetçi
    const auditorInput=document.getElementById('audit-auditor');
    if(auditorInput) auditorInput.value=existingAudit.auditor_name||'';
    _setAuditorDisplay(existingAudit.auditor_name||'');
    // Form kodu etiketi
    const lblEl=document.getElementById('audit-form-code-lbl');
    if(lblEl) lblEl.textContent=existingAudit.form_code||'';

    // Cevapları yükle (varsa)
    const rawAnswers = existingAudit.answers_json;
    const savedAnswers = (typeof rawAnswers==='string') ? JSON.parse(rawAnswers||'{}') : (rawAnswers||{});
    S.answers={}; S.photos={}; S.notes={}; S.typeOverrides={};
    PILLARS.forEach((_,pi)=>{
      S.answers[pi] = savedAnswers[pi] || savedAnswers[String(pi)] || [];
      S.photos[pi]={};
      S.notes[pi]=[];
      PILLARS[pi].questions.forEach((_,qi)=>{ S.answers[pi][qi]=S.answers[pi][qi]??null; S.notes[pi][qi]=''; S.photos[pi][qi]=[]; });
      S.typeOverrides[pi]={};
    });
    showToast('✏️ Denetim düzenleme modunda açıldı');

  } else {
    // Yeni denetim modu
    if(editBanner) editBanner.style.display='none';
    document.getElementById('audit-date').value = new Date().toISOString().split('T')[0];
    const formCode = '5S-'+new Date().getFullYear()+'-'+String(S.audits.length+1).padStart(3,'0');
    document.getElementById('audit-form-code').value = formCode;
    const lblEl = document.getElementById('audit-form-code-lbl');
    if(lblEl) lblEl.textContent = formCode;

    // Denetçi avatar + isim
    _setAuditorDisplay(CURRENT_USER?.name||'');
    const auditorInput=document.getElementById('audit-auditor');
    if(auditorInput&&CURRENT_USER) auditorInput.value=CURRENT_USER.name;

    // QR ile açıldıysa —
    if(window._aktifFormTip){
      // Yeni 4-tip QR sistemi: form tipine göre alanları filtrele
      const tip    = window._aktifFormTip;
      const tipAdi = FORM_TIP_LABEL[tip] || tip;
      const tipRenk= FORM_TIP_RENK[tip]  || 'var(--brand)';
      window._aktifFormTip = null;

      // Alan dropdown'ını bu tipe göre yeniden oluştur
      const filtreliAlanlar = S.areas.filter(a=>getAreaFormTip(a)===tip);
      sel.innerHTML = '<option value="">— ' + tipAdi + ' alanı seçin —</option>';
      const fabMap2={};
      filtreliAlanlar.forEach(a=>{
        const f=a.fabrika||'Genel'; if(!fabMap2[f]) fabMap2[f]={};
        const ad=a.alt_dept||a.dept||'Genel'; if(!fabMap2[f][ad]) fabMap2[f][ad]=[];
        fabMap2[f][ad].push(a);
      });
      Object.entries(fabMap2).forEach(([fab,adMap])=>{
        const og=document.createElement('optgroup'); og.label='🏭 '+fab; sel.appendChild(og);
        Object.entries(adMap).forEach(([ad,areas])=>{
          areas.forEach(a=>{ const opt=document.createElement('option'); opt.value=a.id; opt.textContent=ad+' › '+a.name; og.appendChild(opt); });
        });
      });

      // Üst bilgi banner'ı göster
      const editBanner2 = document.getElementById('audit-edit-banner');
      if(editBanner2){
        editBanner2.style.display='flex';
        editBanner2.innerHTML=`<span style="color:${tipRenk};">📷 ${tipAdi} Formu — Lütfen denetim alanını seçin</span>`;
      }

      _hideAreaQRCard();
      showToast('📷 ' + tipAdi + ' formu açıldı — alanı seçin');

    } else if(window._aktifAtama){
      // Eski alan bazlı QR (geriye uyumluluk)
      const {alanId, alanAd} = window._aktifAtama;
      const area = S.areas.find(a=>a.id===alanId);
      _showAreaQRCard(area || {id:alanId, name:alanAd});
      if(sel) sel.value = alanId;
      const locEl=document.getElementById('audit-location');
      if(locEl&&area) locEl.value=area.fabrika||'';
      showToast('📍 '+alanAd+' — denetim başlatılıyor');
      window._aktifAtama=null;
    } else {
      _hideAreaQRCard();
    }

    S.answers={}; S.photos={}; S.notes={}; S.typeOverrides={};
  }

  const c = document.getElementById('pillars-container');
  c.innerHTML='';
  const isEdit = !!_editAuditId;
  PILLARS.forEach((p,pi)=>{
    if(!isEdit){
      S.answers[pi]=[]; S.photos[pi]={}; S.notes[pi]=[];
      p.questions.forEach((_,qi)=>{ S.answers[pi][qi]=null; S.notes[pi][qi]=''; S.photos[pi][qi]=[]; });
      S.typeOverrides[pi]={};
    }
    const div=document.createElement('div'); div.className='pillar-sec';
    div.innerHTML=`
      <div class="pillar-hdr" onclick="togglePillar(${pi})">
        <div class="pillar-icon" style="background:${p.color}">${p.id}</div>
        <div class="pillar-info"><div class="pillar-name">${p.name}</div><div class="pillar-desc">${p.desc}</div></div>
        <span class="pillar-weight">%${PW[p.id]}</span>
        <span class="pillar-preview" id="pp-${pi}" style="color:var(--text3)">—</span>
        <span class="pillar-toggle" id="pt-${pi}">▼</span>
      </div>
      <div class="pillar-body" id="pb-${pi}">
        ${p.questions.map((q,qi)=>buildQuestion(pi,qi,q)).join('')}
      </div>`;
    c.appendChild(div);
  });
  // Düzenleme modunda kaydedilmiş cevapları UI'a yansıt
  if(isEdit){
    PILLARS.forEach((p,pi)=>{
      p.questions.forEach((q,qi)=>{
        const ans = S.answers[pi]?.[qi];
        if(ans===null||ans===undefined) return;
        const eff=(S.typeOverrides[pi]?.[qi])||q.type;
        if(eff==='count'){
          const cv=document.getElementById('cv-'+pi+'-'+qi); if(cv) cv.textContent=ans;
          const ci=document.getElementById('ci-'+pi+'-'+qi); if(ci) ci.value=ans;
        } else if(eff==='yn'){
          const btn=document.getElementById('yn-'+(ans==='evet'?'e':'h')+'-'+pi+'-'+qi);
          if(btn) btn.classList.add(ans==='evet'?'sel-yes':'sel-no');
        } else if(eff==='yn3'){
          const map={evet:'e',kısmen:'k',hayır:'h'};
          const btn=document.getElementById('yn3-'+map[ans]+'-'+pi+'-'+qi);
          if(btn) btn.classList.add(ans==='hayır'?'sel-no':'sel-yes');
        } else if(eff==='mc'){
          const b=document.getElementById('mc-'+pi+'-'+qi+'-'+ans); if(b) b.classList.add('sel');
        } else if(eff==='score'){
          [0,1,2,3,4].forEach(s=>{ const b=document.getElementById('sb-'+pi+'-'+qi+'-'+s); if(b) b.className='score-btn'+(s===ans?' s'+s:''); });
        }
      });
    });
  }

  updateSummary();
}

function _renderDenetciKartlari(){
  const el=document.getElementById('denetci-kart-listesi'); if(!el) return;
  const denetciler=S.users.filter(u=>u.role==='denetci');
  el.innerHTML=denetciler.map(d=>{
    const myAudits=S.audits.filter(a=>a.auditor_id===d.id||a.auditor_name===d.name).length;
    const bekleyen=(S.atamalar||[]).filter(a=>a.auditor_id===d.id&&a.status==='Bekliyor').length;
    const initials=d.name.split(' ').map(n=>n[0]).join('').substring(0,2);
    return `<div id="dcard-${d.id}" onclick="selectDenetci('${d.id}')" style="cursor:pointer;padding:12px;border:2px solid var(--border);border-radius:var(--r);transition:all .15s;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${initials}</div>
        <div><div style="font-size:13px;font-weight:600;">${d.name}</div><div style="font-size:10px;color:var(--text3);">Denetçi</div></div>
      </div>
      <div style="display:flex;gap:8px;font-size:10px;color:var(--text2);">
        <span>📋 ${myAudits} denetim</span>
        <span style="color:${bekleyen>0?'var(--amber)':'var(--text3)'};">⏳ ${bekleyen} bekliyor</span>
      </div>
    </div>`;
  }).join('')||'<div style="color:var(--text3);font-size:12px;">Denetçi bulunamadı</div>';
}

function _renderBolgeListesi(){
  const listEl=document.getElementById('bolge-secim-listesi');
  const fabFilter=document.getElementById('bolge-fab-filter');
  if(!listEl) return;
  const fabrikalar=['Tümü',...new Set(S.areas.map(a=>a.fabrika||'Diğer'))];
  let aktifFab='Tümü';
  const render=(fab)=>{
    aktifFab=fab;
    if(fabFilter){
      fabFilter.innerHTML=fabrikalar.map(f=>`<button type="button" onclick="window._bolgeFabSec('${f}')" style="padding:4px 10px;border-radius:20px;border:1.5px solid ${f===aktifFab?'var(--brand)':'var(--border)'};background:${f===aktifFab?'var(--brand)':'var(--surface)'};color:${f===aktifFab?'#fff':'var(--text2)'};font-size:11px;font-weight:600;cursor:pointer;">${f}</button>`).join('');
    }
    const filtreliAlanlar=fab==='Tümü'?S.areas:S.areas.filter(a=>(a.fabrika||'Diğer')===fab);
    const gruplar={};
    filtreliAlanlar.forEach(a=>{ const g=a.alt_dept||a.dept||'Genel'; if(!gruplar[g]) gruplar[g]={fab:a.fabrika,dept:a.dept,alanlar:[]}; gruplar[g].alanlar.push(a); });
    listEl.innerHTML=Object.entries(gruplar).map(([grpAd,grp],gi)=>`
      <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;">
        <div onclick="toggleBolgeGrup(${gi})" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface2);cursor:pointer;">
          <span style="font-size:12px;font-weight:700;">${grpAd}</span>
          <span style="font-size:11px;color:var(--text3);" id="bolge-grp-arrow-${gi}">▼</span>
        </div>
        <div id="bolge-grp-${gi}" style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--border);">
          ${grp.alanlar.map(a=>`<label id="blabel-${a.id}" style="cursor:pointer;padding:8px 10px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:7px;">
            <input type="checkbox" id="bchk-${a.id}" value="${a.id}" style="margin-top:2px;width:15px;height:15px;cursor:pointer;" onchange="updateBolgeStyle('${a.id}');updateBolgeOzet();">
            <div style="font-size:12px;font-weight:600;">${a.name}</div>
          </label>`).join('')}
        </div>
      </div>`).join('');
    updateBolgeOzet();
  };
  window._bolgeFabSec=(fab)=>render(fab);
  render('Tümü');
}

function _renderFormSablonDropdown(){
  const sel=document.getElementById('admin-ata-form'); if(!sel) return;
  sel.innerHTML='<option value="default">📋 Üretim Formu</option>';
  (S.formSablonlari||[]).forEach(f=>{ sel.innerHTML+=`<option value="${f.id}">📝 ${f.adi}</option>`; });
}

function selectDenetci(id){
  document.getElementById('admin-ata-denetci').value=id;
  document.querySelectorAll('[id^="dcard-"]').forEach(c=>c.style.borderColor='var(--border)');
  const card=document.getElementById('dcard-'+id);
  if(card) card.style.borderColor='var(--brand)';
}

function updateBolgeStyle(areaId){
  const lbl=document.getElementById('blabel-'+areaId);
  const chk=document.getElementById('bchk-'+areaId);
  if(lbl) lbl.style.background=chk?.checked?'var(--brand-light)':'';
}
function toggleBolgeGrup(gi){
  const el=document.getElementById('bolge-grp-'+gi);
  const arrow=document.getElementById('bolge-grp-arrow-'+gi);
  if(el) el.style.display=el.style.display==='none'?'grid':'none';
  if(arrow) arrow.textContent=el?.style.display==='none'?'▶':'▼';
}
function updateBolgeOzet(){
  const checked=document.querySelectorAll('[id^="bchk-"]:checked');
  const el=document.getElementById('bolge-secim-ozet');
  if(el) el.textContent=checked.length>0?`${checked.length} bölge seçildi`:'Bölge seçilmedi';
}

async function adminDenetimOlustur(){
  const denetciId=document.getElementById('admin-ata-denetci').value;
  const tarih=document.getElementById('admin-ata-tarih').value;
  const vardiya=document.getElementById('admin-ata-vardiya').value;
  const notlar=document.getElementById('admin-ata-not').value;
  const formId=document.getElementById('admin-ata-form').value;
  const seciliBolgeler=[...document.querySelectorAll('[id^="bchk-"]:checked')].map(c=>c.value);

  if(!denetciId){ showToast('⚠ Lütfen bir denetçi seçin!'); return; }
  if(!seciliBolgeler.length){ showToast('⚠ Lütfen en az bir bölge seçin!'); return; }
  if(!tarih){ showToast('⚠ Lütfen tarih seçin!'); return; }

  const denetci=S.users.find(u=>u.id===denetciId);
  const btn=document.querySelector('[onclick="adminDenetimOlustur()"]');
  if(btn){ btn.disabled=true; btn.textContent='Oluşturuluyor...'; }

  try {
    const promises=seciliBolgeler.map(areaId=>{
      const area=S.areas.find(a=>a.id===areaId);
      return apiFetch('/audits/plans', {
        method:'POST',
        body:JSON.stringify({ area_id:areaId, area_name:area?.name||'', auditor_id:denetciId, auditor_name:denetci?.name||'', planned_date:tarih, shift:vardiya, form_template_id:formId, notes:notlar })
      });
    });
    const results=await Promise.all(promises);
    results.forEach(r=>{ if(r) S.atamalar.push(r); });

    showToast(`✓ ${seciliBolgeler.length} denetim ataması oluşturuldu!`);
    const sonuc=document.getElementById('admin-atama-sonuc');
    if(sonuc) sonuc.innerHTML=`<div style="padding:10px;background:var(--green-light);border-radius:var(--rs);color:var(--green);font-size:12px;">✓ ${seciliBolgeler.length} bölge için denetim planlandı · ${denetci?.name||''}</div>`;
    renderAdminBekleyenList();
    updateBadges();
  } catch(err){
    showToast('⚠ '+err.message);
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='✓ Denetim Oluştur ve Ata'; }
  }
}

function renderAdminBekleyenList(){
  const el=document.getElementById('admin-bekleyen-list'); if(!el) return;
  const bekleyenler=(S.atamalar||[]).filter(a=>a.status==='Bekliyor'||a.status==='Devam Ediyor');
  el.innerHTML=bekleyenler.length===0?'<div style="font-size:12px;color:var(--text3);">Bekleyen atama yok</div>'
    :bekleyenler.map(a=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:6px;font-size:12px;">
        <div><b>${a.auditor_name||'—'}</b> · ${a.area_name||'—'}<div style="font-size:11px;color:var(--text3);">${a.planned_date||'—'} · ${a.shift||''}</div></div>
        <button class="btn btn-sm" style="color:var(--red);" onclick="atamaIptal('${a.id}')">İptal</button>
      </div>`).join('');
}

async function atamaIptal(id){
  if(!confirm('Atama iptal edilsin mi?')) return;
  try {
    await apiFetch('/audits/plans/'+id, { method:'PUT', body:JSON.stringify({ status:'İptal' }) });
    const pl=S.atamalar.find(a=>a.id===id); if(pl) pl.status='İptal';
    renderAdminBekleyenList();
    showToast('Atama iptal edildi');
  } catch(err){ showToast('⚠ '+err.message); }
}

// ── Pillar toggle ─────────────────────────────────────────────
function togglePillar(pi){
  const body=document.getElementById('pb-'+pi);
  const toggle=document.getElementById('pt-'+pi);
  if(body){ body.classList.toggle('open'); }
  if(toggle){ toggle.classList.toggle('open'); }
}

// ── Soru HTML oluştur ─────────────────────────────────────────
function buildQuestion(pi, qi, q){
  const wBadge=q.w>=5?'<span class="w-badge-crit">KRİTİK</span>':q.w>=3?'<span class="w-badge-imp">ÖNEMLİ</span>':'';
  const typeToggle=(q.type==='yn3'||q.type==='mc')?`<button class="type-toggle-btn" id="tt-${pi}-${qi}" onclick="toggleQuestionType(${pi},${qi})">🔀 Çoktan Seçmeli</button>`:'';
  const eff=(q.type==='yn3'||q.type==='mc')&&S.typeOverrides[pi]&&S.typeOverrides[pi][qi]?S.typeOverrides[pi][qi]:q.type;
  const effOpts=eff==='mc'?(q.mcOptions||q.options||[]):q.options;
  let ansHtml='';
  if(eff==='yn') ansHtml=`<div class="yn-btns"><button class="yn-btn" id="yn-e-${pi}-${qi}" onclick="setYN(${pi},${qi},'evet')">✓ Evet</button><button class="yn-btn" id="yn-h-${pi}-${qi}" onclick="setYN(${pi},${qi},'hayır')">✗ Hayır</button></div>`;
  else if(eff==='yn3') ansHtml=`<div class="yn-btns"><button class="yn-btn" id="yn3-e-${pi}-${qi}" onclick="setYN3(${pi},${qi},'evet')">✓ Evet</button><button class="yn-btn" id="yn3-k-${pi}-${qi}" onclick="setYN3(${pi},${qi},'kısmen')" style="color:var(--amber);">◑ Kısmen</button><button class="yn-btn" id="yn3-h-${pi}-${qi}" onclick="setYN3(${pi},${qi},'hayır')">✗ Hayır</button></div>`;
  else if(eff==='count') ansHtml=`<div class="count-wrap"><button class="count-btn" onclick="changeCount(${pi},${qi},-1)">−</button><span class="count-val" id="cv-${pi}-${qi}">0</span><button class="count-btn" onclick="changeCount(${pi},${qi},1)">+</button><span class="count-label">${q.countLabel||'adet'}</span><input type="number" min="0" id="ci-${pi}-${qi}" value="0" style="width:60px;font-size:13px;padding:5px 8px;margin-left:4px;" oninput="setCount(${pi},${qi},+this.value)"></div>`;
  else if(eff==='score') ansHtml=`<div class="score-opts">${[0,1,2,3,4].map(s=>`<button class="score-btn" id="sb-${pi}-${qi}-${s}" onclick="setScore(${pi},${qi},${s})">${s}</button>`).join('')}</div>`;
  else if(eff==='mc') ansHtml=`<div class="mc-opts">${(effOpts||[]).map((o,oi)=>`<button class="mc-btn" id="mc-${pi}-${qi}-${oi}" onclick="setMC(${pi},${qi},${oi})">${o}</button>`).join('')}</div>`;

  const photoHtml=`<div class="photo-zone" id="pz-${pi}-${qi}" onclick="triggerPhoto(${pi},${qi})"><div class="photo-zone-label"><span>📷</span><span id="pz-lbl-${pi}-${qi}">Fotoğraf ekle (opsiyonel)</span></div><div class="photo-previews" id="pp-prev-${pi}-${qi}"></div></div><input type="file" id="pf-${pi}-${qi}" accept="image/*" multiple style="display:none;" onchange="handlePhotos(${pi},${qi},this)">`;

  return `<div class="q-item"><div class="q-text"><span class="q-num">${qi+1}.</span><span>${q.text}</span></div><div class="q-badges">${wBadge}${typeToggle}</div><div class="ans-wrap">${ansHtml}</div>${q.photo?photoHtml:''}<div class="q-note"><input type="text" placeholder="Not ekle..." value="" oninput="S.notes[${pi}][${qi}]=this.value"></div></div>`;
}

function toggleQuestionType(pi,qi){
  if(!S.typeOverrides[pi]) S.typeOverrides[pi]={};
  const q=PILLARS[pi].questions[qi];
  const cur=S.typeOverrides[pi][qi]||q.type;
  S.typeOverrides[pi][qi]=(cur==='yn3')?'mc':'yn3';
  const body=document.getElementById('pb-'+pi);
  if(body){ body.innerHTML=PILLARS[pi].questions.map((qx,qxi)=>buildQuestion(pi,qxi,qx)).join(''); }
  updateSummary();
}

// ── Cevap setleyiciler ────────────────────────────────────────
function setYN(pi,qi,v){
  S.answers[pi][qi]=v;
  document.querySelectorAll(`[id^="yn-"][id$="-${pi}-${qi}"]`).forEach(b=>b.classList.remove('sel-yes','sel-no'));
  const btn=document.getElementById(`yn-${v==='evet'?'e':'h'}-${pi}-${qi}`);
  if(btn) btn.classList.add(v==='evet'?'sel-yes':'sel-no');
  updateSummary();
}
function setYN3(pi,qi,v){
  S.answers[pi][qi]=v;
  ['e','k','h'].forEach(x=>{ const b=document.getElementById(`yn3-${x}-${pi}-${qi}`); if(b) b.classList.remove('sel-yes','sel-no'); });
  const map={evet:'e',kısmen:'k',hayır:'h'};
  const btn=document.getElementById(`yn3-${map[v]}-${pi}-${qi}`);
  if(btn) btn.classList.add(v==='hayır'?'sel-no':'sel-yes');
  updateSummary();
}
function changeCount(pi,qi,d){
  const cur=S.answers[pi][qi]||0;
  setCount(pi,qi,Math.max(0,cur+d));
}
function setCount(pi,qi,v){
  const val=Math.max(0,v);
  S.answers[pi][qi]=val;
  const cv=document.getElementById('cv-'+pi+'-'+qi); if(cv) cv.textContent=val;
  const ci=document.getElementById('ci-'+pi+'-'+qi); if(ci) ci.value=val;
  updatePhotoRequired(pi,qi,val>0);
  updateSummary();
}
function setScore(pi,qi,v){
  S.answers[pi][qi]=v;
  [0,1,2,3,4].forEach(s=>{ const b=document.getElementById('sb-'+pi+'-'+qi+'-'+s); if(b) b.className='score-btn'+(s===v?' s'+s:''); });
  updateSummary();
}
function setMC(pi,qi,idx){
  S.answers[pi][qi]=idx;
  const q=PILLARS[pi].questions[qi];
  const opts=(q.mcOptions||q.options||[]);
  opts.forEach((_,i)=>{ const b=document.getElementById('mc-'+pi+'-'+qi+'-'+i); if(b) b.classList.toggle('sel',i===idx); });
  updateSummary();
}

function updatePhotoRequired(pi,qi,required){
  const pz=document.getElementById('pz-'+pi+'-'+qi);
  const lbl=document.getElementById('pz-lbl-'+pi+'-'+qi);
  if(pz){ pz.classList.toggle('photo-required',required); }
  if(lbl) lbl.textContent=required?'⚠ Fotoğraf zorunlu':'Fotoğraf ekle (opsiyonel)';
}

function triggerPhoto(pi,qi){ document.getElementById('pf-'+pi+'-'+qi)?.click(); }

function handlePhotos(pi,qi,input){
  if(!S.photos[pi]) S.photos[pi]={};
  if(!S.photos[pi][qi]) S.photos[pi][qi]=[];
  [...input.files].forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{ S.photos[pi][qi].push(e.target.result); renderPhotoPreview(pi,qi); };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function renderPhotoPreview(pi,qi){
  const el=document.getElementById('pp-prev-'+pi+'-'+qi); if(!el) return;
  el.innerHTML=(S.photos[pi]?.[qi]||[]).map((src,i)=>`<div class="photo-thumb"><img src="${src}"><button class="photo-del" onclick="removePhoto(${pi},${qi},${i})">✕</button></div>`).join('');
}
function removePhoto(pi,qi,i){ S.photos[pi][qi].splice(i,1); renderPhotoPreview(pi,qi); }

// ── Özet panel ─────────────────────────────────────────────────
function updateSummary(){
  const sumEl=document.getElementById('score-summary'); if(!sumEl) return;
  const totEl=document.getElementById('total-score-display');
  const badgeEl=document.getElementById('score-badge-display');

  const results=PILLARS.map((p,pi)=>({ ...calcPillar(pi, S.answers[pi]||[]), p }));
  const total=Math.round(results.reduce((t,r)=>t+r.contribution,0));

  sumEl.innerHTML=results.map(r=>`
    <div class="sum-pillar">
      <div class="sp-id">${r.p.id}</div>
      <div class="sp-pct" style="color:${scoreColor(r.pct)};">${r.pct||0}%</div>
      <div class="sp-wt">${r.contribution||0} / ${PW[r.p.id]} pt</div>
    </div>`).join('');

  if(totEl) totEl.textContent=total+' / 100';
  if(badgeEl) badgeEl.innerHTML=`<span class="badge ${scoreBadge(total)}" style="font-size:14px;padding:6px 14px;">${scoreLabel(total)}</span>`;

  results.forEach((r,pi)=>{
    const pp=document.getElementById('pp-'+pi);
    if(pp){ pp.textContent=r.pct+'%'; pp.style.color=scoreColor(r.pct); }
  });

  // İlerleme çubuğunu güncelle
  let answered=0, totalQ=0;
  PILLARS.forEach((p,pi)=>{
    p.questions.forEach((_,qi)=>{
      totalQ++;
      const ans=S.answers[pi]?.[qi];
      if(ans!==null&&ans!==undefined) answered++;
    });
  });
  const pct=totalQ?Math.round(answered/totalQ*100):0;
  const progBar=document.getElementById('audit-progress-bar');
  const progTxt=document.getElementById('audit-progress-txt');
  if(progBar) progBar.style.width=pct+'%';
  if(progTxt) progTxt.textContent=`${answered} / ${totalQ} soru cevaplandı`;
  const progWrap=document.getElementById('audit-progress-wrap');
  if(progWrap) progWrap.style.display='block';
}

// ── Denetim kaydet ────────────────────────────────────────────
let _submitInProgress = false;

async function submitAudit(withReport=false){
  if(_submitInProgress) return;   // çift tıklama koruması
  const areaId   = document.getElementById('audit-area')?.value;
  // Dropdown metni "dept › name" formatındadır; temiz ismi S.areas'dan al
  const areaObj  = S.areas.find(a=>a.id===areaId);
  const areaName = areaObj?.name || (document.getElementById('audit-area')?.selectedOptions[0]?.text||'').split('›').pop().trim();
  const date     = document.getElementById('audit-date')?.value;
  const shift    = document.getElementById('audit-shift')?.value;
  const formCode = document.getElementById('audit-form-code')?.value;
  const location = document.getElementById('audit-location')?.value;
  const teamLead = document.getElementById('audit-team-leader')?.value;
  const auditor  = document.getElementById('audit-auditor')?.value;

  if(!areaId)  { showToast('⚠ Lütfen denetlenen takımı seçin!'); return; }
  if(!date)    { showToast('⚠ Lütfen denetim tarihini girin!'); return; }
  if(!auditor) { showToast('⚠ Lütfen denetçi seçin!'); return; }

  const total=Math.round(PILLARS.reduce((t,p,pi)=>t+calcPillar(pi,S.answers[pi]||[]).contribution,0));
  const pillarsJson={};
  PILLARS.forEach((p,pi)=>{ pillarsJson[p.id]=calcPillar(pi,S.answers[pi]||[]); });

  const body={
    area_id:areaId, area_name:areaName, date, shift, total_score:total,
    pillars_json:pillarsJson, answers_json:S.answers,
    notes_json:S.notes, photos_json:S.photos,
    status:'tamamlandi', form_code:formCode, location, team_leader:teamLead,
  };

  _submitInProgress = true;
  // Tüm kaydet butonlarını devre dışı bırak
  const saveBtns = document.querySelectorAll('[onclick="submitAudit()"], [onclick="submitAndReport()"]');
  saveBtns.forEach(b=>{ b.disabled=true; });
  const btn = saveBtns[0];
  if(btn) btn.innerHTML = '<span class="spinner"></span>Kaydediliyor...';

  try {
    let result;
    if(_editAuditId){
      // Güncelleme modu — PUT
      result = await apiFetch('/audits/'+_editAuditId, { method:'PUT', body:JSON.stringify(body) });
      if(!result) return;
      const idx = S.audits.findIndex(a=>a.id===_editAuditId);
      if(idx>-1) S.audits[idx]={...S.audits[idx],...result};
      showToast('✓ Denetim güncellendi!');
      _editAuditId=null;
    } else {
      // Yeni denetim — POST
      result = await apiFetch('/audits', { method:'POST', body:JSON.stringify(body) });
      if(!result) return;
      S.audits.unshift(result);
      showToast('✓ Denetim başarıyla kaydedildi!');
      // Atama varsa kapat
      if(window._aktifAtamaId){
        await atamaKapat(window._aktifAtamaId, result.id);
        window._aktifAtamaId=null;
      }
    }
    updateBadges();
    if(withReport) showDetail(result.id);
    else navigate('history');
  } catch(err){
    showToast('⚠ '+err.message);
  } finally {
    _submitInProgress = false;
    saveBtns.forEach(b=>{ b.disabled=false; });
    if(btn) btn.textContent = '✓ Denetimi Kaydet';
  }
}

function submitAndReport(){ submitAudit(true); }
function resetAudit(){ if(confirm('Formu sıfırla?')) initForm(); }

// ── Auditor Modal ─────────────────────────────────────────────
function openAuditorModal(){
  const list=document.getElementById('auditor-list');
  list.innerHTML=S.auditors.map(a=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:var(--rs);margin-bottom:6px;cursor:pointer;" onclick="selectAuditor('${a}')">
      <div style="display:flex;align-items:center;gap:9px;"><div style="width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;">${a.split(' ').map(n=>n[0]).join('').substring(0,2)}</div><span>${a}</span></div>
      <span style="font-size:11px;color:var(--brand);">Seç →</span>
    </div>`).join('');
  openModal('modal-auditor');
}
function selectAuditor(name){
  document.getElementById('audit-auditor').value=name;
  const disp=document.getElementById('auditor-display');
  if(disp){ disp.textContent=name; disp.style.fontWeight='500'; disp.style.color='var(--accent)'; }
  closeModal('modal-auditor');
}
function addNewAuditor(){
  const inp=document.getElementById('new-auditor-name');
  const name=inp.value.trim();
  if(!name){ showToast('⚠ Denetçi adı girin!'); return; }
  if(!S.auditors.includes(name)) S.auditors.push(name);
  selectAuditor(name); inp.value='';
}

// ── Denetim geçmişi ─────────────────────────────────────────
function renderHistory(){
  const tbody=document.getElementById('hist-tbody'); if(!tbody) return;
  const search=(document.getElementById('hist-search')?.value||'').toLowerCase();
  let audits=[...S.audits].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(search) audits=audits.filter(a=>(a.area_name||'').toLowerCase().includes(search)||(a.auditor_name||'').toLowerCase().includes(search));

  const countLbl=document.getElementById('hist-count-lbl');
  if(countLbl) countLbl.textContent=audits.length+' kayıt';

  // Edit area dropdown doldur
  const editArea=document.getElementById('edit-area');
  if(editArea){ editArea.innerHTML=S.areas.map(a=>`<option value="${a.id}">${a.name}</option>`).join(''); }

  tbody.innerHTML=audits.length===0?'<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:28px;">Kayıt yok</td></tr>'
    :audits.map((a,i)=>`
      <tr>
        <td style="font-family:var(--mono);font-size:11px;">#${i+1}</td>
        <td>${a.date||'—'}</td>
        <td>${a.area_name||'—'}</td>
        <td>${a.auditor_name||'—'}</td>
        <td>${a.shift||'—'}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:var(--mono);font-weight:700;font-size:14px;color:${sLevelColor(calculateSLevel(a))};">${formatSLevel(calculateSLevel(a))}</span>
            <span style="font-size:10px;color:var(--text3);">(${a.total_score||0})</span>
          </div>
          <div class="sbar" style="margin-top:3px;"><div class="sbar-fill ${calculateSLevel(a)>=4?'hi':calculateSLevel(a)>=2?'md':'lo'}" style="width:${calculateSLevel(a)/5*100}%;"></div></div>
        </td>
        <td><span class="badge ${sLevelBadge(calculateSLevel(a))}">${sLevelLabel(calculateSLevel(a))}</span></td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="showDetail('${a.id}')">Detay</button>
          ${CURRENT_USER?.role==='admin'||CURRENT_USER?.role==='denetci'
            ?`<button class="btn btn-outline btn-sm" style="color:var(--brand);" onclick="editAudit('${a.id}')">✏️ Düzenle</button>`:''}
          ${CURRENT_USER?.role==='admin'?`<button class="btn btn-sm" style="color:var(--red);" onclick="delAudit('${a.id}')">Sil</button>`:''}
        </td>
      </tr>`).join('');
}

async function delAudit(id){
  if(!confirm('Bu denetim kalıcı olarak silinecek. Emin misiniz?')) return;
  try {
    await apiFetch('/audits/'+id, { method:'DELETE' });
    S.audits=S.audits.filter(a=>a.id!==id);
    renderHistory(); updateBadges();
    showToast('Denetim silindi');
  } catch(err){ showToast('⚠ '+err.message); }
}

function openEditModal(id){
  const a=S.audits.find(x=>x.id===id); if(!a) return;
  document.getElementById('edit-audit-id').value=id;
  document.getElementById('edit-area').value=a.area_id||'';
  document.getElementById('edit-auditor').value=a.auditor_name||'';
  document.getElementById('edit-date').value=a.date||'';
  document.getElementById('edit-shift').value=a.shift||'Sabah';
  document.getElementById('edit-location').value=a.location||'';
  document.getElementById('edit-dept').value=a.dept||'';
  document.getElementById('edit-team-leader').value=a.team_leader||'';
  document.getElementById('edit-form-code').value=a.form_code||'';
  openModal('modal-edit-audit');
}

async function saveEditAudit(){
  const id=document.getElementById('edit-audit-id').value;
  const body={
    area_id:document.getElementById('edit-area').value,
    area_name:document.getElementById('edit-area')?.selectedOptions[0]?.text||'',
    auditor_name:document.getElementById('edit-auditor').value,
    date:document.getElementById('edit-date').value,
    shift:document.getElementById('edit-shift').value,
    location:document.getElementById('edit-location').value,
    team_leader:document.getElementById('edit-team-leader').value,
    form_code:document.getElementById('edit-form-code').value,
  };
  try {
    const updated=await apiFetch('/audits/'+id, { method:'PUT', body:JSON.stringify(body) });
    if(updated){ const idx=S.audits.findIndex(a=>a.id===id); if(idx>-1) S.audits[idx]={...S.audits[idx],...updated}; }
    closeModal('modal-edit-audit'); renderHistory();
    showToast('✓ Denetim güncellendi');
  } catch(err){ showToast('⚠ '+err.message); }
}

function showDetail(id){
  const a=S.audits.find(x=>x.id===id); if(!a) return;
  document.getElementById('det-title').textContent='Denetim Detayı — '+a.area_name;
  document.getElementById('det-sub').textContent=a.date+' · '+a.auditor_name+' · '+a.shift;
  const detAiBtn=document.getElementById('det-ai-btn');
  if(detAiBtn) detAiBtn.onclick=()=>{ buildOfflineReport(a); };
  const detDenetBtn=document.getElementById('det-denetlenen-btn');
  if(detDenetBtn) detDenetBtn.onclick=()=>{ denetlenenRaporu(a.id); };

  const pjsRaw=a.pillars_json||{};
  // pillars_json can be {S1:{pct,contribution},...} or array [{pct,contribution},...]
  const pjsByKey = Array.isArray(pjsRaw)
    ? PILLARS.reduce((m,p,i)=>{ m[p.id]=pjsRaw[i]||{}; return m; }, {})
    : pjsRaw;
  const pjs = pjsByKey;
  const sl = calculateSLevel(a);
  const pillarHtml=PILLARS.map(p=>{
    const d=pjs[p.id]||{}; const pct=d.pct||0;
    const passed=pillarPassed(pct);
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:24px;height:24px;border-radius:5px;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;">${p.id}</div>
      <div style="flex:1;font-size:12px;">${p.name}</div>
      <span style="font-size:10px;font-weight:700;${passed?'color:#16a34a;':'color:#ef4444;'};flex-shrink:0;">${passed?'✓':'✗'}</span>
      <div class="sbar-wrap" style="width:100px;"><div class="sbar"><div class="sbar-fill ${pct>=90?'hi':pct>=50?'md':'lo'}" style="width:${pct}%;"></div></div><span class="sbar-val">${pct}%</span></div>
    </div>`;
  }).join('');

  // Fotoğrafları topla
  const photosRaw = a.photos_json || {};
  const allPhotos = [];
  PILLARS.forEach((p, pi) => {
    p.questions.forEach((q, qi) => {
      const imgs = photosRaw[pi]?.[qi] || photosRaw[String(pi)]?.[String(qi)] || [];
      imgs.forEach(src => allPhotos.push({ src, label: `${p.id} · S.${qi+1}` }));
    });
  });
  const photoHtml = allPhotos.length ? `
    <div style="margin-top:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📷 Fotoğraflar (${allPhotos.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${allPhotos.map(p=>`
          <div style="position:relative;">
            <img src="${p.src}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--border);cursor:pointer;" onclick="openPhotoFull('${p.src}')" title="${p.label}">
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.5);color:#fff;font-size:9px;text-align:center;border-radius:0 0 6px 6px;padding:2px;">${p.label}</div>
          </div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('det-content').innerHTML=`
    <div style="text-align:center;margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#f8fafc,#eef2f7);border-radius:var(--r);border:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">5S SEVİYESİ</div>
      <div style="font-size:56px;font-weight:800;font-family:var(--mono);color:${sLevelColor(sl)};line-height:1;">${formatSLevel(sl)}</div>
      <div style="font-size:11px;color:var(--text3);margin:2px 0 8px;">Toplam Puan: ${a.total_score||0}/100</div>
      <span class="badge ${sLevelBadge(sl)}" style="font-size:13px;margin-top:4px;">${sLevelLabel(sl)}</span>
      <div style="margin-top:12px;">
        <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${sl/5*100}%;background:${sLevelColor(sl)};border-radius:4px;transition:width .4s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:3px;"><span>0S</span><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>
      </div>
    </div>
    ${pillarHtml}
    ${photoHtml}`;
  openModal('modal-detail');
}

function openPhotoFull(src){
  const ov = document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:zoom-out;';
  ov.innerHTML=`<img src="${src}" style="max-width:95vw;max-height:95vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6);">`;
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
}

// ── Pillar analiz metinleri ───────────────────────────────────
const PILLAR_ANALYSIS = {
  S1: {
    hi:  'Ayıklama faaliyetleri mükemmel düzeyde yürütülmektedir. Çalışma alanında yalnızca prosese doğrudan katkı sağlayan malzeme, ekipman ve dokümanlar bulunmakta; gereksiz öğelerin birikmesi sistematik biçimde engellenmektedir. Kırmızı etiket uygulaması rutin hale gelmiş, operatörler neyin kullanılıp neyin atılacağına bağımsız karar verebilecek düzeye ulaşmıştır. Bu olgunluk düzeyi, iş güvenliği risklerini ve arama kaynaklı zaman kayıplarını minimuma indirmektedir.',
    ok:  'Ayıklama çalışmaları genel olarak yeterli düzeydedir. Çalışma noktalarının büyük çoğunluğu düzenli tutulmakla birlikte bazı noktalarda prosesle ilişkisiz malzeme, kişisel eşya veya eskimiş doküman birikimi dikkat çekmektedir. Bu durumun operasyonel verimliliği ve ergonomiyi kısmen olumsuz etkileme potansiyeli mevcuttur. Periyodik kırmızı etiket kampanyaları ile mevcut iyilik hali pekiştirilebilir.',
    mid: 'Çalışma alanında anlamlı düzeyde gereksiz malzeme, ekipman ve doküman birikimi gözlemlenmektedir. Prosesle doğrudan ilişkisi olmayan öğeler tezgâh üzerlerini, çekmeceleri ve geçiş alanlarını işgal etmekte; bu durum hem iş güvenliği hem de üretim verimliliği açısından risk oluşturmaktadır. Arızalı ve kalibrasyonu geçmiş ekipmanların sahada bulunması, yanlış ekipman kullanımına ve kalite sorunlarına zemin hazırlayabilir. Sistematik bir kırmızı etiket kampanyasının acilen planlanması önerilmektedir.',
    lo:  'Ayıklama pillarında kritik düzeyde eksiklikler tespit edilmiştir. Prosesle ilgisi olmayan malzeme, kişisel eşya ve güncelliğini yitirmiş talimatların yoğun birikimi; çalışma alanının kullanılabilir yüzeyini önemli ölçüde daraltmaktadır. Arızalı ve kullanım dışı ekipmanların saha genelinde dağınık biçimde bulunması hem iş kazası riskini hem de üretim verimsizliğini artırmaktadır. Acil eylem planı hazırlanmadan herhangi bir diğer 5S pillarında sürdürülebilir iyileşme sağlamak mümkün değildir.',
    risk:   'Bloke geçiş yolları → yangın/tahliye riski · Arızalı ekipman kullanımı → kalite hatası ve iş kazası riski · Arama kaynaklı zaman kaybı → OEE düşüşü',
    impact: 'Ergonomi, İSG uyumu, ekipman güvenilirliği, üretim hızı',
    quick_win: 'Bu hafta: Tüm tezgâh üstleri ve geçiş koridorları için 30 dakikalık acil kırmızı etiket turu yapın.',
    rec_mid: 'Aylık kırmızı etiket kampanyası takvime alınmalı; her çalışma noktası için "İzin verilen maksimum öğe sayısı" fotoğraflı standart hazırlanmalı.',
    rec_lo:  'Tüm çalışma noktaları için acil kırmızı etiket seferberliği başlatılmalı. Arızalı ekipmanlar CMMS\'e kaydedilerek karantinaya alınmalı. Kırmızı etiket kararı için net kriter listesi oluşturulmalı ve ekibe dağıtılmalı.',
    road_urgent: 'Acil geçiş yollarını temizle · Arızalı ekipmanları etiketle ve karantinaya al',
    road_30: 'Tüm alan için kırmızı etiket kampanyası yap · "Bir yerde bir kez" standardı oluştur',
    road_90: 'Aylık ayıklama rutinini sisteme al · Operatörlere kırmızı etiket karar yetkisi ver',
  },
  S2: {
    hi:  'Düzenleme pilları, "Her şeyin bir yeri var ve her şey yerinde" prensibinin tam anlamıyla hayata geçirildiğini göstermektedir. Tüm el aletleri, aparatlar, ölçü aletleri ve sarf malzemeler için görsel alan tanımları yapılmış; gölge panolar, zemin çizgileri ve renk kodlaması etkin biçimde kullanılmaktadır. Acil durum ekipmanlarına (yangın tüpü, ilk yardım dolabı, göz duşu) erişim hiçbir engel olmaksızın sağlanmaktadır. Min/maks seviyeleri belirlenmiş stok yönetimi, aşırı stok ve eksiklik problemlerinin önüne geçmektedir.',
    ok:  'Alan tanımları genel olarak oluşturulmuş ve büyük ölçüde uygulanmaktadır. Bununla birlikte bazı ekipman ve malzemelerin zaman zaman tanımlı alanların dışına taştığı ya da tanımsız noktalarda bırakıldığı görülmektedir. Görsel yönetim altyapısı temel düzeyde mevcut olmakla birlikte bazı etiket ve zemin işaretlerinin yenilenmesi gerekmektedir. Min/maks seviyeleri konusunda tutarsızlıklar dikkat çekmektedir.',
    mid: 'Düzenleme çalışmaları kısmen uygulanmış ancak tutarlılık sağlanamamıştır. Bir kısım ekipman ve malzeme için alan tanımı yapılmışken diğerleri hâlâ belirsiz konumlarda bulunmaktadır. Bu durum operatörlerin ihtiyaç duydukları aletleri bulmak için harcadıkları süreyi artırmakta, prosesteki akışkanlığı olumsuz etkilemektedir. Acil durum ekipmanlarına erişimin kısmen kısıtlı olması önemli bir İSG bulgusudur.',
    lo:  'Alan tanımları büyük ölçüde yetersiz ya da tamamen yok düzeyindedir. Malzeme ve ekipmanlar belirsiz noktalarda bulunmakta; operatörler çalışma süresinin önemli bir bölümünü arama ve bekleme ile geçirmektedir. Acil durum ekipmanlarına erişimin engellenmiş olması derhal müdahale gerektiren kritik bir İSG bulgusudur. Görsel yönetim altyapısının sıfırdan kurulması zorunludur.',
    risk:   'Acil durum erişim engeli → yangın ve iş kazasında hayati risk · Arama kaybı → operatör başına günlük 15-30 dk verimlilik kaybı · Yanlış ekipman kullanımı → kalite hatası',
    impact: 'İSG uyumu, operatör verimliliği, kalite güvenilirliği, set-up süreleri',
    quick_win: 'Bu hafta: Yangın tüpü, ilk yardım dolabı ve acil çıkışların önündeki tüm engelleri kaldırın.',
    rec_mid: 'Her çalışma noktası için fotoğraflı "standart yerleşim haritası" hazırlanmalı; gölge pano eksiklikleri tamamlanmalı.',
    rec_lo:  'Önce acil durum yolları açılmalı. Ardından tüm ekipman için alan tanımı çalışması (makine başına 1 saat) yapılmalı. Zemin bant çalışması ve raf etiketleme standart hale getirilmeli.',
    road_urgent: 'Acil durum erişimini aç · En sık kullanılan 10 ekipman için alan belirle',
    road_30: 'Tüm ekipman için gölge pano ve zemin çizgisi tamamla · Min/maks seviyelerini belirle',
    road_90: 'Görsel yönetim denetim checklistini oluştur · 5S turu ile aylık doğrulama yap',
  },
  S3: {
    hi:  'Temizlik standartları mükemmel düzeyde sürdürülmektedir. Makine gövdeleri, tezgâh yüzeyleri, zemin ve çevre alanlar düzenli ve titiz biçimde temizlenmektedir. Temizlik sorumlulukları operatör bazında bölge matrisine göre net şekilde tanımlanmış; her vardiya temizlik kontrolü rutin hale gelmiştir. Otonom bakım faaliyetleri kapsamında operatörler anormallikleri (sızıntı, pas, çap) erken tespit edebilmekte ve raporlayabilmektedir. Bu durum bakım maliyetlerini düşürmekte ve ekipman ömrünü uzatmaktadır.',
    ok:  'Temizlik genel olarak iyi düzeyde sağlanmaktadır. Çalışma alanının büyük bölümü temiz tutulmakla birlikte bazı noktalarda yüzey kirliliği, toz birikimi, pas veya boya lekesi dikkat çekmektedir. Temizlik sorumlulukları çoğunlukla belirlenmiş olmakla birlikte tatil veya vardiya değişimlerinde sürekliliğin korunması güçleşmektedir. Daha sistematik bir sorumluluk matrisi ve periyodik doğrulama ile mevcut performans üst seviyelere taşınabilir.',
    mid: 'Temizlik çalışmaları sporadik olarak yapılmakta, ancak sürdürülebilirlik henüz sağlanamamaktadır. Yüzey kirlilikleri, pas izleri veya sıvı birikintileri pek çok noktada görülmektedir. Temizlik sorumluluklarının net dağılımı yapılmamış ya da operatörler tarafından bilinmemektedir. Bu durum makine arıza sıklığını artırma ve yüzey kaynaklı kalite sorunlarına zemin hazırlama potansiyeli taşımaktadır.',
    lo:  'Temizlik standartları kritik düzeyde yetersizdir. Yüzey kirlilikleri, paslı parçalar, sıvı sızıntıları ve talaş/çap birikintileri yaygın biçimde gözlemlenmektedir. Bu durum üç temel risk oluşturmaktadır: (1) İSG riski — kayma, düşme ve sağlık tehlikesi; (2) Ekipman riski — korozyon ve mekanik hasar ile erken arıza; (3) Kalite riski — kirlilik kaynaklı ürün hatası. Acil müdahale yapılmadan bu alan, hem iç denetim hem de müşteri ziyaretleri açısından ciddi risk barındırmaktadır.',
    risk:   'Zemin kirliliği → kayma ve düşme kazası · Sıvı sızıntısı → yangın/elektrik riski · Yüzey kirliliği → ürün kontaminasyonu · Pas/çap → ekipman arızası',
    impact: 'İSG skoru, ekipman OEE, ürün kalitesi, müşteri denetim sonucu',
    quick_win: 'Bu hafta: Her operatöre 2 m² sorumluluk alanı ata ve günlük 5 dakika temizlik rutini başlat.',
    rec_mid: 'Temizlik bölge matrisi oluşturulmalı ve görünür yere asılmalı. Vardiya başı 5 dakikalık "temizlik turu" standardize edilmeli.',
    rec_lo:  'Önce sıvı sızıntıları ve yangın riski oluşturan kirlilikler giderilmeli. Ardından tüm alan için kapsamlı temizlik seferberliği planlanmalı. Günlük kontrol formu ve haftalık lider doğrulaması sisteme alınmalı.',
    road_urgent: 'Sızıntı ve kayma tehlikelerini gider · Temizlik malzemesi istasyonu kur',
    road_30: 'Bölge matrisi oluştur · Vardiya başı rutin başlat · Otonom bakım kontrol listesi hazırla',
    road_90: 'Görsel temizlik standardı (fotoğraflı) oluştur · Aylık temizlik denetim puanlaması yap',
  },
  S4: {
    hi:  'Standartlaştırma çalışmaları üst düzeyde hayata geçirilmiş ve sürdürülmektedir. Standart Operasyon Formları (SOF) güncel tutulmakta ve tüm operatörler tarafından bilinmektedir. Etiketleme, renk kodlama ve işaretleme uygulamaları firma standartlarıyla tam uyum içindedir. Görsel yönetim araçları sayesinde herhangi bir çalışan ya da ziyaretçi, alandaki anormal durumları kısa sürede fark edebilmektedir. Otonom bakım formları düzenli güncellenmekte; "Bir Fikrim Var" ve Ramakkala sistemleri aktif kullanılmaktadır.',
    ok:  'Standartlar büyük ölçüde belirlenmiş ve uygulanmaktadır. SOF formlarının büyük çoğunluğu güncel olmakla birlikte bazı proseslerde güncelleme gecikmesi ya da operatör bilgi eksikliği dikkat çekmektedir. Etiketleme tutarsızlıkları ve bazı görsel standartların eskimesi performansı kısmen sınırlamaktadır. Düzenli revizyon döngüsü ve operatör bilgilendirme seanslarıyla bu boşluklar kapatılabilir.',
    mid: 'Standartlar kısmen oluşturulmuş olmakla birlikte tutarlı uygulama sağlanamamaktadır. SOF formları ya güncel değil ya da operatörlerin büyük çoğunluğu tarafından bilinmemektedir. Görsel standartlar (etiket, işaret, renk kodu) yeterli düzeyde uygulanmadığından anormallik tespiti güçleşmektedir. Bu durum hem eğitim süresini uzatmakta hem de yeni operatörlerin sürece adaptasyonunu yavaşlatmaktadır.',
    lo:  'Standartlaştırma çalışmaları yetersiz kalmaktadır. SOF formları ya mevcut değil ya da uzun süredir güncellenmemiştir. Etiketleme ve işaretlemeler firma standartlarına uygun değil ya da büyük ölçüde eksiktir. Bu durumun doğrudan sonuçları; operasyon tutarsızlığı, eğitim verimsizliği ve anormallik görünürlüğünün olmamasıdır. Müşteri veya sertifikasyon denetimleri açısından ciddi uyumsuzluk riski barındırmaktadır.',
    risk:   'Güncel olmayan SOF → hatalı üretim ve kalite kaçağı · Standartsız alan → yeni operatör adaptasyon süresi artışı · Görsel yönetim eksikliği → anormallik fark edilemez',
    impact: 'Kalite tutarlılığı, eğitim süresi, denetim uyumu, operasyonel risk',
    quick_win: 'Bu hafta: Mevcut SOF formlarını yazdırıp her iş istasyonuna asın; operatörlere 10 dakikalık özet hatırlatma yapın.',
    rec_mid: 'SOF formları tüm prosesler için gözden geçirilmeli ve güncel fotoğraflarla zenginleştirilmeli. "Bir Fikrim Var" panosu aktive edilmeli.',
    rec_lo:  'Önce en kritik 3 proses için SOF hazırlanmalı. Tüm etiketler firma standardına göre yenilenmeli. Operatör bilgi testi ile eksiklikler ölçülmeli ve eğitim planı hazırlanmalı.',
    road_urgent: 'Kritik prosesler için SOF bas ve as · En çok hata yapılan noktalara görsel uyarı koy',
    road_30: 'Tüm SOF\'ları güncelle · Etiketleme ve renk kodlamayı standartlaştır · Operatör bilgi testi yap',
    road_90: 'SOF revizyon takvimi oluştur · Ramakkala ve "Bir Fikrim Var" sistemini aktive et · Yıllık standart güncelleme döngüsü kur',
  },
  S5: {
    hi:  '5S kültürü ekip tarafından tam anlamıyla benimsenmiş ve içselleştirilmiştir. Vardiya devir-teslimlerinde 5S kontrol formu rutin olarak uygulanmakta; operatörler kendi sorumluluk alanlarının sahiplenme bilinci ile hareket etmektedir. Önceki denetim aksiyonlarının takip oranı yüksek, "Bir Fikrim Var" sistemi aktif kullanımdadır. Bu olgunluk düzeyi, 5S\'in bir "denetim hazırlığı" değil, gerçek bir çalışma kültürü haline geldiğini göstermekte ve sürekli iyileştirme faaliyetlerine zemin oluşturmaktadır.',
    ok:  '5S disiplini genel olarak sürdürülmektedir. Ekibin büyük çoğunluğu 5S prensiplerine hâkimdir ve günlük rutinlerine yansıtmaktadır. Bununla birlikte bazı üyelerin katılım düzeyi ve bazı proseslerdeki süreklilik hâlâ güçlendirilmeye ihtiyaç duymaktadır. Önceki denetim aksiyonlarının bir bölümü gerçekleştirilmemiş ya da takip edilmemiştir. Liderlik desteğinin artırılması ve ödüllendirici bir geri bildirim sistemiyle disiplin üst seviyelere taşınabilir.',
    mid: '5S disiplini kısmen sağlanmaktadır; ancak süreklilik henüz kazanılamamıştır. Ekip üyelerinin önemli bir bölümü 5S gerekliliklerini tam olarak içselleştirememiştir. Vardiya kontrolü ve önceki aksiyon takibi düzensiz yapılmakta, "Bir Fikrim Var" sistemi aktif kullanılmamaktadır. Bu durumun temel nedeni yönetimsel sahiplenme ve görünür liderlik eksikliği olabilir. Kapsamlı bir bilinçlendirme ve eğitim planı olmadan diğer pillarlardaki iyileştirmelerin sürdürülmesi güçleşecektir.',
    lo:  '5S kültürü henüz ekip tarafından benimsenmemiştir. Operatörlerin büyük çoğunluğu 5S\'in amacını ve günlük çalışmalarına yansımasını tam olarak bilmemektedir. Vardiya kontrolü yapılmamakta, aksiyon takip sistemi işletilmemekte, sürekli iyileştirme mekanizmaları pasif durmaktadır. Bu durum diğer tüm pillarlardaki iyileştirmelerin uzun vadede geri gitmesine yol açacaktır. Kültürel dönüşüm için üst yönetim taahhüdü, yapılandırılmış eğitim ve görünür liderlik zorunludur.',
    risk:   'Disiplin eksikliği → diğer 4 pillardaki kazanımlar kalıcılaşmaz · Aksiyon takipsizliği → tekrar eden sorunlar · Kültür boşluğu → yeni çalışan uyumu zorlaşır',
    impact: 'Tüm 5S pillarlarının sürdürülebilirliği, sürekli iyileştirme kapasitesi, çalışan bağlılığı',
    quick_win: 'Bu hafta: Her vardiya başında 5 dakikalık 5S kontrol turu rutinini başlatın ve sonucu pano üzerinde işaretleyin.',
    rec_mid: '"Bir Fikrim Var" panosu aktive edilmeli ve aylık değerlendirme toplantısına alınmalı. Vardiya kontrol formu standartlaştırılmalı.',
    rec_lo:  'Tüm ekip için zorunlu 5S temel eğitimi planlanmalı (min. 2 saat). Liderler tarafından günlük görünür saha turu başlatılmalı. Aksiyon takip panosu kurulmalı ve haftalık güncellenmeli.',
    road_urgent: 'Vardiya kontrol formunu bas ve kullanıma al · Aksiyon takip panosunu kur',
    road_30: 'Tüm ekibe 5S temel eğitimi ver · "Bir Fikrim Var" sistemini aktive et · İlk aksiyon kapanışlarını gerçekleştir',
    road_90: 'Aylık 5S değerlendirme döngüsü kur · En iyi uygulama örneklerini diğer alanlara aktar · Ödüllendirme sistemi tasarla',
  },
};

function _getPillarText(id, pct, field){
  const t=PILLAR_ANALYSIS[id]; if(!t) return '';
  if(field==='desc')   return pct>=85?t.hi:pct>=70?t.ok:pct>=50?t.mid:t.lo;
  if(field==='rec')    return pct<70?(pct<50?t.rec_lo:t.rec_mid):'';
  if(field==='risk')   return t.risk||'';
  if(field==='impact') return t.impact||'';
  if(field==='quick')  return t.quick_win||'';
  return '';
}

// Bir pillar içindeki düşük puanlı soruları döndür
function _getWeakQuestions(audit, pi, threshold){
  threshold = threshold||3;
  const answersRaw = audit.answers_json||{};
  const anss = answersRaw[pi]||answersRaw[String(pi)]||[];
  const p = PILLARS[pi];
  const results = [];
  p.questions.forEach(function(q,qi){
    const ans = anss[qi];
    const sc = getAnswerScore(q, ans, pi, qi);
    if(sc!==null && sc<threshold){
      results.push({q:q, qi:qi, ans:ans, sc:sc});
    }
  });
  return results;
}

function _execSummary(score, areaName, weakest, strongest, badCount, prevDiff){
  const area = areaName||'denetlenen alan';
  const trendNote = prevDiff!==null ? (prevDiff>0?' Bir önceki denetime göre <b>'+prevDiff+' puan artış</b> kaydedilmiştir.':prevDiff<0?' Bir önceki denetime göre <b>'+Math.abs(prevDiff)+' puan düşüş</b> gözlemlenmektedir.':' Puan önceki dönemle aynı düzeyde seyretmektedir.'):'';
  if(score>=85) return '<b>'+area+'</b> alanı bu denetimde <b>'+score+' puan</b> ile mükemmel bir performans sergilemiştir. 5S uygulamaları sistematik ve sürdürülebilir biçimde yürütülmekte; <b>'+strongest.name.split('(')[0].trim()+'</b> başta olmak üzere tüm pillarlarda üst düzey başarı görülmektedir. Bu alan, iyi uygulama örneği olarak diğer alanlara referans gösterilebilir.'+trendNote;
  if(score>=70) return '<b>'+area+'</b> alanı bu denetimde <b>'+score+' puan</b> ile iyi bir performans ortaya koymuştur. Genel tablo olumlu olmakla birlikte <b>'+weakest.name.split('(')[0].trim()+'</b> pillarındaki eksiklikler giderildiğinde üst düzey performansa ulaşmak mümkündür. Tespit edilen <b>'+badCount+' iyileştirme noktasının</b> aksiyona bağlanması önerilmektedir.'+trendNote;
  if(score>=50) return '<b>'+area+'</b> alanı bu denetimde <b>'+score+' puan</b> ile orta düzey bir performans sergilemiştir. <b>'+weakest.name.split('(')[0].trim()+'</b> pillarındaki ciddi eksiklikler genel puanı aşağıya çekmektedir. En güçlü pillar olan <b>'+strongest.name.split('(')[0].trim()+'</b> iyi bir başlangıç noktası oluşturmaktadır; bu alandaki başarı modelinin diğer pillarlara aktarılması önerilmektedir.'+trendNote;
  return '<b>'+area+'</b> alanı bu denetimde <b>'+score+' puan</b> almış olup kapsamlı iyileştirme gerektiren bir tablo ortaya çıkmıştır. Birden fazla pillarda kritik eksiklikler tespit edilmiş olup anlık iş güvenliği ve kalite riskleri barındırmaktadır. Yönetim taahhüdü ve kaynak desteğiyle hazırlanacak acil aksiyon planı hayata geçirilmeden sürdürülebilir iyileşme sağlanamayacaktır.'+trendNote;
}

function buildOfflineReport(audit){
  openModal('modal-ai');
  document.getElementById('ai-title').textContent='5S Denetim Raporu — '+(audit.area_name||'');
  const dateStr=(audit.date||'').slice(0,10);
  document.getElementById('ai-sub').textContent=dateStr+' · '+(audit.auditor_name||'')+' · '+(audit.shift||'');
  document.getElementById('ai-loading').style.display='none';

  const pjsRaw=audit.pillars_json||{};
  const pjs=Array.isArray(pjsRaw)
    ?PILLARS.reduce((m,p,i)=>{m[p.id]=pjsRaw[i]||{};return m;},{})
    :pjsRaw;

  const score=audit.total_score||0;
  const pillarData=PILLARS.map(p=>({...p,pct:Math.round(pjs[p.id]?.pct||0),contrib:pjs[p.id]?.contribution||0}));
  const sorted=[...pillarData].sort((a,b)=>b.pct-a.pct);
  const strongest=sorted[0], weakest=sorted[sorted.length-1];
  const goodPillars=pillarData.filter(p=>p.pct>=70);
  const badPillars=pillarData.filter(p=>p.pct<70).sort((a,b)=>a.pct-b.pct);

  // ── Trend tarihi (son 6 denetim)
  const sameAreaAudits=S.audits
    .filter(a=>a.area_id===audit.area_id && a.id!==audit.id)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const prev=sameAreaAudits.filter(a=>a.date<=(audit.date||'9')).slice(-1)[0]||null;
  const trendDiff=prev?score-(prev.total_score||0):null;
  const last5=[...sameAreaAudits.slice(-5),audit].sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  // ── Fabrika içi kıyaslama
  const fabrikaAudits=S.audits.filter(function(a){
    const ar=S.areas.find(function(x){return x.id===a.area_id;});
    const thisAr=S.areas.find(function(x){return x.id===audit.area_id;});
    return ar&&thisAr&&ar.fabrika===thisAr.fabrika&&a.total_score!=null;
  });
  // Her alan için en son denetim puanı
  const areaLatest={};
  fabrikaAudits.forEach(function(a){
    if(!areaLatest[a.area_id]||a.date>areaLatest[a.area_id].date) areaLatest[a.area_id]=a;
  });
  const latestScores=Object.values(areaLatest).map(function(a){return a.total_score||0;});
  const fabrikaAvg=latestScores.length?Math.round(latestScores.reduce(function(t,s){return t+s;},0)/latestScores.length):null;
  const fabrikaRank=latestScores.length?latestScores.filter(function(s){return s>score;}).length+1:null;
  const fabrikaTotal=latestScores.length;

  // ── Risk seviyesi
  const riskLevel=score>=85?{label:'Düşük Risk',color:'#16a34a',bg:'#f0fdf4',border:'#86efac',icon:'🟢'}
    :score>=70?{label:'Orta-Düşük Risk',color:'#2563eb',bg:'#eff6ff',border:'#bfdbfe',icon:'🔵'}
    :score>=50?{label:'Orta-Yüksek Risk',color:'#d97706',bg:'#fffbeb',border:'#fde68a',icon:'🟡'}
    :{label:'Yüksek Risk',color:'#dc2626',bg:'#fef2f2',border:'#fecaca',icon:'🔴'};

  // ── Özet istatistikler
  const totalQuestions=PILLARS.reduce(function(t,p){return t+p.questions.length;},0);
  var answeredCount=0, weakQCount=0;
  PILLARS.forEach(function(p,pi){
    const wqs=_getWeakQuestions(audit,pi,4);
    const answersRaw=audit.answers_json||{};
    const anss=answersRaw[pi]||answersRaw[String(pi)]||[];
    p.questions.forEach(function(q,qi){
      if(anss[qi]!==null&&anss[qi]!==undefined) answeredCount++;
    });
    weakQCount+=wqs.length;
  });
  var perfectQCount=answeredCount-weakQCount;

  // ── S-Level hesapla
  var sLevel=calculateSLevel(audit);

  // ── BÖLÜM 1: Başlık kartı (HTML string olarak)
  var headerHtml='<div style="text-align:center;padding:24px 20px 20px;background:linear-gradient(135deg,#f8fafc,#eef2f7);border-radius:var(--r);margin-bottom:20px;border:1px solid var(--border);">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">5S SEVİYESİ</div>'
    +'<div style="font-size:72px;font-weight:800;font-family:var(--mono);color:'+sLevelColor(sLevel)+';line-height:1;">'+formatSLevel(sLevel)+'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin:2px 0 10px;">Toplam Puan: '+score+' / 100</div>'
    +'<span class="badge '+sLevelBadge(sLevel)+'" style="font-size:14px;padding:6px 18px;">'+sLevelLabel(sLevel)+'</span>'
    +'<div style="display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:4px 10px;background:'+riskLevel.bg+';border:1px solid '+riskLevel.border+';border-radius:20px;font-size:11px;font-weight:600;color:'+riskLevel.color+';">'+riskLevel.icon+' '+riskLevel.label+'</div>'
    // 0S-5S bar
    +'<div style="margin:14px 0 8px;">'
    +'<div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">'
    +'<div style="height:100%;width:'+Math.round(sLevel/5*100)+'%;background:'+sLevelColor(sLevel)+';border-radius:5px;"></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:3px;"><span>0S</span><span>1S</span><span>2S</span><span>3S</span><span>4S</span><span>5S</span></div>'
    +'</div>'
    // Pillar grid — S durumu göster
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px;">'
    +pillarData.map(function(p,i){
      var passed=pillarPassed(p.pct);
      return '<div style="text-align:center;padding:8px 4px;background:#fff;border:2px solid '+(passed?'#86efac':'#fecaca')+';border-radius:var(--r);">'
        +'<div style="width:20px;height:20px;border-radius:5px;background:'+p.color+';margin:0 auto 5px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;">'+p.id+'</div>'
        +'<div style="font-size:14px;font-weight:700;color:'+sLevelColor(p.pct/100*5)+';">'+p.pct+'%</div>'
        +'<div style="font-size:10px;font-weight:700;margin-top:2px;'+(passed?'color:#16a34a;':'color:#ef4444;')+'">'+(passed?'✓ Geçti':'✗ Takıldı')+'</div>'
        +'</div>';
    }).join('')
    +'</div>'
    // Özet istatistikler
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;">'
    +'<div style="padding:8px;background:#fff;border:1px solid var(--border);border-radius:var(--r);"><div style="font-size:16px;font-weight:700;color:#16a34a;">'+perfectQCount+'</div><div style="font-size:9px;color:var(--text3);">Tam Puan</div></div>'
    +'<div style="padding:8px;background:#fff;border:1px solid var(--border);border-radius:var(--r);"><div style="font-size:16px;font-weight:700;color:#ef4444;">'+weakQCount+'</div><div style="font-size:9px;color:var(--text3);">İyileştirme</div></div>'
    +'<div style="padding:8px;background:#fff;border:1px solid var(--border);border-radius:var(--r);"><div style="font-size:16px;font-weight:700;color:var(--text1);">'+answeredCount+'/'+totalQuestions+'</div><div style="font-size:9px;color:var(--text3);">Cevaplanan</div></div>'
    +'</div>'
    +'</div>';

  // ── BÖLÜM 2: Yönetici özeti
  var summaryHtml='<div style="margin-bottom:20px;padding:16px;background:#f8fafc;border-left:4px solid '+scoreColor(score)+';border-radius:0 var(--r) var(--r) 0;">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📋 Yönetici Özeti</div>'
    +'<div style="font-size:12px;color:var(--text1);line-height:1.7;">'+_execSummary(score,audit.area_name,weakest,strongest,weakQCount,trendDiff)+'</div>'
    +'</div>';

  // ── BÖLÜM 3: Trend + Kıyaslama yan yana
  // Mini trend bar chart (son 5 denetim)
  var trendBarsHtml='';
  if(last5.length>1){
    const maxS=Math.max.apply(null,last5.map(function(a){return a.total_score||0;}));
    trendBarsHtml='<div style="display:flex;align-items:flex-end;gap:4px;height:48px;margin-bottom:6px;">'
      +last5.map(function(a){
        const s=a.total_score||0;
        const h=maxS>0?Math.round((s/maxS)*48):4;
        const isCurrent=a.id===audit.id;
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">'
          +'<div style="font-size:8px;color:var(--text3);">'+s+'</div>'
          +'<div style="width:100%;border-radius:3px 3px 0 0;background:'+(isCurrent?scoreColor(s):'#cbd5e1')+';height:'+h+'px;"></div>'
          +'</div>';
      }).join('')
      +'</div>'
      +'<div style="display:flex;gap:4px;">'
      +last5.map(function(a){
        const isCurrent=a.id===audit.id;
        return '<div style="flex:1;font-size:8px;color:'+(isCurrent?'var(--text1)':'var(--text3)')+';text-align:center;font-weight:'+(isCurrent?'700':'400')+';">'+((a.date||'').slice(5,10))+'</div>';
      }).join('')
      +'</div>';
  }

  var trendCardHtml='<div style="padding:12px 14px;background:'+(trendDiff===null?'#f8fafc':trendDiff>=0?'#f0fdf4':'#fff7ed')+';border:1px solid '+(trendDiff===null?'var(--border)':trendDiff>=0?'#86efac':'#fdba74')+';border-radius:var(--r);">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">📈 Tarihsel Trend</div>'
    +(trendBarsHtml||'')
    +(trendDiff!==null
      ?'<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,.06);">'
        +'<div style="font-size:20px;font-weight:800;color:'+(trendDiff>=0?'#16a34a':'#ea580c')+';font-family:var(--mono);">'+(trendDiff>=0?'+':'')+trendDiff+'</div>'
        +'<div style="font-size:11px;color:var(--text2);">önceki denetime göre<br><b>'+(trendDiff>0?'İlerleme ✓':trendDiff<0?'Gerileme — sebep araştırılmalı':'Değişim yok')+'</b></div>'
        +'</div>'
      :'<div style="font-size:11px;color:var(--text3);margin-top:4px;">Bu alan için ilk denetim kaydıdır.</div>'
    )
    +'</div>';

  var benchmarkHtml='<div style="padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:var(--r);">'
    +'<div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🏭 Fabrika İçi Kıyaslama</div>'
    +(fabrikaAvg!==null
      ?'<div style="margin-bottom:10px;">'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px;"><span>Bu Alan</span><span style="font-weight:700;color:'+scoreColor(score)+';">'+score+'</span></div>'
        +'<div style="height:8px;background:#e2e8f0;border-radius:4px;margin-bottom:6px;"><div style="height:8px;background:'+scoreColor(score)+';border-radius:4px;width:'+score+'%;"></div></div>'
        +'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px;"><span>Fabrika Ort.</span><span style="font-weight:700;">'+fabrikaAvg+'</span></div>'
        +'<div style="height:8px;background:#e2e8f0;border-radius:4px;"><div style="height:8px;background:#94a3b8;border-radius:4px;width:'+fabrikaAvg+'%;"></div></div>'
        +'</div>'
        +'<div style="font-size:11px;color:var(--text2);padding-top:8px;border-top:1px solid var(--border);">'
        +'Sıralama: <b style="color:'+scoreColor(score)+';">'+fabrikaRank+'. / '+fabrikaTotal+' alan</b>'
        +(score>=fabrikaAvg?' · Fabrika ortalamasının <b>üzerinde</b> ✓':' · Fabrika ortalamasının <b>altında</b>')
        +'</div>'
      :'<div style="font-size:11px;color:var(--text3);">Kıyaslama için yeterli veri yok.</div>'
    )
    +'</div>';

  var trendCompareHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">'+trendCardHtml+benchmarkHtml+'</div>';

  // ── BÖLÜM 4: Pillar Bazlı Detaylı Analiz
  var pillarHtml='';
  var _rpPhotosRaw=audit.photos_json||{};  // fotoğraf erişimi için
  PILLARS.forEach(function(p,pi){
    const pd=pillarData[pi];
    const desc=_getPillarText(p.id,pd.pct,'desc');
    const risk=_getPillarText(p.id,pd.pct,'risk');
    const impact=_getPillarText(p.id,pd.pct,'impact');
    const quick=_getPillarText(p.id,pd.pct,'quick');

    // Tüm soruları tara: zayıf olanlar + fotoğraflı olanlar gösterilir
    var answersRaw=audit.answers_json||{};
    var anss=answersRaw[pi]||answersRaw[String(pi)]||[];
    var qRows='';
    var hasAnyRow=false;

    p.questions.forEach(function(q,qi){
      var ans=anss[qi];
      var sc=getAnswerScore(q,ans,pi,qi);
      var imgs=(_rpPhotosRaw[pi]&&_rpPhotosRaw[pi][qi])||(_rpPhotosRaw[String(pi)]&&_rpPhotosRaw[String(pi)][String(qi)])||[];
      var isWeak=(sc!==null&&sc<4);
      var hasPhotos=imgs.length>0;

      if(!isWeak&&!hasPhotos) return; // iyi puan + fotoğraf yok → gösterme

      hasAnyRow=true;
      var scColor=sc===null?'#94a3b8':sc===0?'#ef4444':sc<=2?'#f97316':sc===3?'#eab308':'#16a34a';
      var scBg=sc===null?'#f1f5f9':sc===0?'#fef2f2':sc<=2?'#fff7ed':sc===3?'#fefce8':'#f0fdf4';

      // Fotoğraf thumbnails — DOM ile oluştur
      var thumbsHtml='';
      if(hasPhotos){
        imgs.forEach(function(src){
          var el=document.createElement('div');
          el.style.cssText='position:relative;flex-shrink:0;';
          var img=document.createElement('img');
          img.src=src;
          img.style.cssText='width:72px;height:72px;object-fit:cover;border-radius:6px;border:2px solid '+p.color+';cursor:zoom-in;display:block;';
          img.onclick=function(){ openPhotoFull(src); };
          el.appendChild(img);
          thumbsHtml+=el.outerHTML;
        });
        thumbsHtml='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;">'+thumbsHtml+'</div>';
      }

      qRows+='<div style="padding:8px 10px;margin-bottom:6px;background:'+scBg+';border:1px solid '+(isWeak?(sc===0?'#fecaca':sc<=2?'#fed7aa':'#fef08a'):'var(--border)')+';border-radius:var(--rs);border-left:3px solid '+scColor+';">'
        +'<div style="display:flex;align-items:flex-start;gap:7px;">'
        +'<span style="background:'+scColor+';color:#fff;border-radius:3px;padding:1px 6px;font-weight:700;flex-shrink:0;font-size:10px;margin-top:1px;">'+(sc!==null?sc+'/4':'—')+'</span>'
        +'<div style="flex:1;">'
        +'<div style="font-size:11px;color:var(--text1);line-height:1.5;font-weight:'+(isWeak?'600':'400')+';">S'+(qi+1)+'. '+q.text+'</div>'
        +(ans!==null&&ans!==undefined?'<div style="font-size:10px;color:'+scColor+';margin-top:2px;font-weight:600;">Cevap: '+_answerLabel(q,ans)+'</div>':'')
        +thumbsHtml
        +'</div>'
        +'</div>'
        +'</div>';
    });

    var weakQHtml=hasAnyRow
      ?'<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--border);">'
        +'<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:8px;">Soru Detayları</div>'
        +qRows
        +'</div>'
      :'';

    // Risk ve etki
    var riskImpactHtml='';
    if(risk||impact){
      riskImpactHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
      if(risk) riskImpactHtml+='<div style="padding:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--rs);font-size:11px;"><b style="color:#c2410c;">⚠ Risk</b><br><span style="color:var(--text2);">'+risk+'</span></div>';
      if(impact) riskImpactHtml+='<div style="padding:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--rs);font-size:11px;"><b style="color:#1d4ed8;">📌 Etkilediği Alanlar</b><br><span style="color:var(--text2);">'+impact+'</span></div>';
      riskImpactHtml+='</div>';
    }

    // Hızlı kazanım
    var quickHtml=quick&&pd.pct<85
      ?'<div style="margin-top:10px;padding:8px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--rs);font-size:11px;"><b style="color:#15803d;">⚡ Hızlı Kazanım</b> — '+quick+'</div>'
      :'';

    pillarHtml+='<div style="margin-bottom:16px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--r);border-left:4px solid '+p.color+';">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
      +'<div style="width:28px;height:28px;border-radius:6px;background:'+p.color+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">'+p.id+'</div>'
      +'<div style="flex:1;"><div style="font-size:13px;font-weight:600;">'+p.name+'</div><div style="font-size:10px;color:var(--text3);">'+p.desc+'</div></div>'
      +'<div style="text-align:right;">'
      +'<div style="font-size:20px;font-weight:700;font-family:var(--mono);color:'+scoreColor(pd.pct)+';">'+pd.pct+'%</div>'
      +'<span class="badge '+scoreBadge(pd.pct)+'" style="font-size:9px;">'+scoreLabel(pd.pct)+'</span>'
      +'</div>'
      +'</div>'
      +'<div class="sbar" style="margin-bottom:10px;"><div class="sbar-fill '+(pd.pct>=85?'hi':pd.pct>=50?'md':'lo')+'" style="width:'+pd.pct+'%;"></div></div>'
      +'<div style="font-size:12px;color:var(--text2);line-height:1.7;">'+desc+'</div>'
      +weakQHtml
      +riskImpactHtml
      +quickHtml
      +'</div>';
  });

  // ── BÖLÜM 5: Güçlü / Zayıf pillarlar yan yana
  var strongWeakHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">';
  // Güçlü
  strongWeakHtml+='<div style="padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);">'
    +'<div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">💪 Güçlü Yönler</div>';
  if(goodPillars.length){
    goodPillars.forEach(function(p){
      strongWeakHtml+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">'
        +'<div style="width:14px;height:14px;border-radius:3px;background:'+p.color+';flex-shrink:0;"></div>'
        +'<span style="font-size:11px;"><b>'+p.name.split('(')[0].trim()+'</b> — '+p.pct+'%'
        +(p.pct>=85?' ✓ Mükemmel':' İyi')+'</span>'
        +'</div>';
    });
  } else {
    strongWeakHtml+='<div style="font-size:11px;color:var(--text3);">Henüz 70% üzeri pillar yok.</div>';
  }
  strongWeakHtml+='</div>';
  // Zayıf
  strongWeakHtml+='<div style="padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--r);">'
    +'<div style="font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">⚠ Geliştirilmesi Gereken</div>';
  if(badPillars.length){
    badPillars.forEach(function(p){
      const urgColor=p.pct<50?'#dc2626':'#f97316';
      strongWeakHtml+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">'
        +'<div style="width:14px;height:14px;border-radius:3px;background:'+urgColor+';flex-shrink:0;"></div>'
        +'<span style="font-size:11px;"><b>'+p.name.split('(')[0].trim()+'</b> — <span style="color:'+urgColor+';">'+p.pct+'%</span>'
        +(p.pct<50?' 🔴 Kritik':' 🟠 Orta')+'</span>'
        +'</div>';
    });
  } else {
    strongWeakHtml+='<div style="font-size:11px;color:#16a34a;">Tüm pillarlar 70%+ seviyesinde! 🎉</div>';
  }
  strongWeakHtml+='</div></div>';

  // ── BÖLÜM 6: İyileştirme Yol Haritası (sadece eksik pillar varsa)
  var roadmapHtml='';
  if(badPillars.length){
    const urgentItems=[], week30Items=[], week90Items=[];
    badPillars.forEach(function(p){
      const pa=PILLAR_ANALYSIS[p.id];
      if(pa){
        if(pa.road_urgent) urgentItems.push('<b style="color:'+p.color+';">'+p.id+':</b> '+pa.road_urgent);
        if(pa.road_30)     week30Items.push('<b style="color:'+p.color+';">'+p.id+':</b> '+pa.road_30);
        if(pa.road_90)     week90Items.push('<b style="color:'+p.color+';">'+p.id+':</b> '+pa.road_90);
      }
    });
    roadmapHtml='<div style="margin-bottom:20px;">'
      +'<div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">🗺 İyileştirme Yol Haritası</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">';
    // Acil
    roadmapHtml+='<div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--r);">'
      +'<div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;margin-bottom:8px;">⚡ Acil (Bu Hafta)</div>'
      +urgentItems.map(function(t){return '<div style="font-size:11px;color:var(--text1);margin-bottom:4px;line-height:1.4;">▸ '+t+'</div>';}).join('')
      +'</div>';
    // 30 gün
    roadmapHtml+='<div style="padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--r);">'
      +'<div style="font-size:10px;font-weight:700;color:#c2410c;text-transform:uppercase;margin-bottom:8px;">📅 Kısa Vadeli (30 Gün)</div>'
      +week30Items.map(function(t){return '<div style="font-size:11px;color:var(--text1);margin-bottom:4px;line-height:1.4;">▸ '+t+'</div>';}).join('')
      +'</div>';
    // 90 gün
    roadmapHtml+='<div style="padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);">'
      +'<div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;margin-bottom:8px;">🎯 Uzun Vadeli (90 Gün)</div>'
      +week90Items.map(function(t){return '<div style="font-size:11px;color:var(--text1);margin-bottom:4px;line-height:1.4;">▸ '+t+'</div>';}).join('')
      +'</div>'
      +'</div></div>';
  }

  // ── BÖLÜM 7: Öncelikli aksiyonlar (butonlu)
  const _auditAreaId=audit.area_id||'';
  const _auditAreaName=audit.area_name||'';
  var actionItemsHtml='';
  badPillars.forEach(function(p){
    const rec=_getPillarText(p.id,p.pct,'rec');
    if(!rec) return;
    const prio=p.pct<50?'Kritik':'Yüksek';
    const titleText=p.id+' · '+p.name.split('(')[0].trim()+': '+rec;
    const safeTitle=titleText.replace(/'/g,'&#39;');
    actionItemsHtml+='<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--rs);">'
      +'<div style="width:20px;height:20px;border-radius:50%;background:'+(p.pct<50?'#ef4444':'#f97316')+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:1px;">'+(p.pct<50?'!':'▲')+'</div>'
      +'<div style="flex:1;font-size:12px;line-height:1.5;"><b style="color:'+p.color+';">'+p.id+' · '+p.name.split('(')[0].trim()+':</b> '+rec+'</div>'
      +'<button onclick="openActionFromReport(\''+audit.id+'\',\''+_auditAreaId+'\',\''+_auditAreaName+'\',\''+safeTitle+'\',\''+prio+'\')" style="flex-shrink:0;font-size:10px;padding:4px 10px;border-radius:4px;border:1px solid #f97316;background:#fff7ed;color:#c2410c;cursor:pointer;font-weight:600;white-space:nowrap;">➕ Aksiyon Ekle</button>'
      +'</div>';
  });
  var actionsHtml=actionItemsHtml
    ?'<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🎯 Öncelikli İyileştirme Aksiyonları</div>'+actionItemsHtml+'</div>'
    :'';

  // ── BÖLÜM 8: Sonuç
  const conclusionMap={
    lo:'Sonuç olarak, <b>'+(audit.area_name||'bu alan')+'</b> acil ve sistematik 5S müdahalesi gerektirmektedir. Yukarıda belirlenen aksiyonların önceliklendirilmesi, sorumlu atanması ve takip takviminin oluşturulması büyük önem taşımaktadır. Yönetim taahhüdü olmadan sürdürülebilir iyileşme sağlanamayacağı göz önünde bulundurulmalıdır. Bir sonraki denetimde kaydedilen ilerlemenin ölçülmesi önerilmektedir.',
    mid:'<b>'+(audit.area_name||'Bu alan')+'</b> için belirlenen aksiyon maddelerinin sorumlu kişilere atanması ve ilerlemenin aylık olarak izlenmesi önerilmektedir. Mevcut güçlü pillarlar baz alınarak diğer alanlara iyi uygulama transferi yapılabilir. Tutarlı uygulamayla önümüzdeki denetimde belirgin ilerleme sağlanması mümkündür.',
    ok:'<b>'+(audit.area_name||'Bu alanda')+'</b> iyi bir 5S performansı sergilenmektedir. Zayıf kalan pillarlardaki hedefe yönelik iyileştirmelerle mükemmel seviyeye ulaşmak mümkündür. Ekibin sahiplenme ve motivasyon düzeyinin korunması ve en iyi uygulamaların diğer alanlara yaygınlaştırılması önerilmektedir.',
    hi:'<b>'+(audit.area_name||'Bu alan')+'</b> 5S uygulamalarında fabrika genelinde örnek bir seviyededir. Bu başarının belgelenerek diğer alanlara ilham kaynağı olması için iyi uygulama videosu veya çapraz ziyaret organizasyonu değerlendirilebilir. Mevcut standardın sürdürülmesi için düzenli denetim döngüsünün korunması yeterli olacaktır.',
  };
  const conclusionKey=score>=85?'hi':score>=70?'ok':score>=50?'mid':'lo';
  var conclusionHtml='<div style="padding:14px 16px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);margin-bottom:16px;">'
    +'<div style="font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">✅ Sonuç ve Genel Değerlendirme</div>'
    +'<div style="font-size:12px;color:var(--text1);line-height:1.7;">'+conclusionMap[conclusionKey]+'</div>'
    +'</div>';

  // ── Tüm bölümleri birleştir
  var footerHtml='<div style="margin-top:16px;font-size:10px;color:var(--text3);text-align:center;border-top:1px solid var(--border);padding-top:10px;">'
    +'Rapor Tarihi: '+new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})
    +' · Denetim No: '+(audit.form_code||'—')+' · Denetçi: '+(audit.auditor_name||'—')
    +'</div>';

  var fullHtml='<div style="font-size:13px;line-height:1.6;">'
    +headerHtml
    +summaryHtml
    +trendCompareHtml
    +'<div style="margin-bottom:20px;"><div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">🔍 Pillar Bazlı Detaylı Analiz</div>'+pillarHtml+'</div>'
    +strongWeakHtml
    +roadmapHtml
    +actionsHtml
    +conclusionHtml
    +footerHtml
    +'</div>';

  document.getElementById('ai-content').innerHTML=fullHtml;
  document.getElementById('ai-content').style.display='block';
  document.getElementById('pdf-btn').style.display='';
}

// ── Denetlenen Raporu — olumsuz bulgular + fotoğraflar ───────────────────────
function _answerLabel(q, ans){
  if(ans===null||ans===undefined) return '—';
  if(q.type==='count') return `${ans} adet`;
  if(q.type==='yn') return ans==='evet'?'Evet':'Hayır';
  if(q.type==='yn3') return ans==='evet'?'Evet':ans==='kısmen'?'Kısmen':'Hayır';
  if(q.type==='mc'||q.type==='score'){
    const opts=q.options||q.mcOptions||[];
    return opts[ans]!==undefined?opts[ans]:String(ans);
  }
  return String(ans);
}

function denetlenenRaporu(auditId){
  const audit=S.audits.find(a=>a.id===auditId)||{};
  openModal('modal-ai');
  document.getElementById('ai-title').textContent='Bulgular Raporu — '+(audit.area_name||'');
  const dateStr=(audit.date||'').slice(0,10);
  document.getElementById('ai-sub').textContent=`${dateStr} · Denetçi: ${audit.auditor_name||''} · ${audit.shift||''}`;
  document.getElementById('ai-loading').style.display='none';

  const score=audit.total_score||0;
  const answersRaw=audit.answers_json||{};
  const photosRaw=audit.photos_json||{};
  const notesRaw=audit.notes_json||{};

  const getAnss=pi=>answersRaw[pi]??answersRaw[String(pi)]??[];
  const getImgs=(pi,qi)=>photosRaw[pi]?.[qi]??photosRaw[String(pi)]?.[String(qi)]??[];
  const getNote=(pi,qi)=>{
    const n=notesRaw[pi]??notesRaw[String(pi)]??[];
    return (Array.isArray(n)?n[qi]:n[qi])||'';
  };

  // Her pillar için olumsuz bulgular (puan < 4)
  const findingGroups=[];
  PILLARS.forEach((p,pi)=>{
    const anss=getAnss(pi);
    const items=[];
    p.questions.forEach((q,qi)=>{
      const ans=anss[qi];
      const sc=getAnswerScore(q,ans,pi,qi);
      if(sc===null) return; // cevaplanmamış
      if(sc>=4) return;     // mükemmel → gösterme
      const imgs=getImgs(pi,qi);
      const note=getNote(pi,qi);
      const severity=sc===0?'crit':sc<=2?'warn':'info';
      items.push({q,qi,ans,sc,imgs,note,severity});
    });
    if(items.length) findingGroups.push({p,pi,items});
  });

  // Renk yardımcısı
  const sevColor={crit:'#ef4444',warn:'#f97316',info:'#eab308'};
  const sevBg={crit:'#fef2f2',warn:'#fff7ed',info:'#fefce8'};
  const sevBorder={crit:'#fecaca',warn:'#fed7aa',info:'#fef08a'};
  const sevLabel={crit:'Olumsuz',warn:'Geliştirilmeli',info:'Dikkat'};

  // findingsHtml — iç içe backtick kullanmadan string birleştirme ile oluştur
  var findingsHtml='';
  if(!findingGroups.length){
    findingsHtml='<div style="text-align:center;padding:30px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);">'
      +'<div style="font-size:32px;margin-bottom:8px;">🎉</div>'
      +'<div style="font-size:14px;font-weight:700;color:#15803d;">Tüm sorular mükemmel puanla tamamlandı!</div>'
      +'<div style="font-size:12px;color:var(--text2);margin-top:4px;">Bu alanda herhangi bir olumsuz bulgu tespit edilmemiştir.</div>'
      +'</div>';
  } else {
    findingGroups.forEach(function(fg){
      var p=fg.p, items=fg.items;
      var groupHtml='<div style="margin-bottom:20px;">'
        +'<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:'+p.color+'22;border:1px solid '+p.color+'66;border-radius:var(--r);margin-bottom:10px;">'
        +'<div style="width:26px;height:26px;border-radius:6px;background:'+p.color+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;">'+p.id+'</div>'
        +'<div style="font-size:13px;font-weight:700;color:var(--text1);">'+p.name+'</div>'
        +'<div style="margin-left:auto;font-size:11px;color:var(--text3);">'+items.length+' bulgu</div>'
        +'</div>';
      items.forEach(function(item){
        var q=item.q, qi=item.qi, ans=item.ans, sc=item.sc, imgs=item.imgs, note=item.note, sev=item.severity;
        var sc_=sevColor[sev], sb_=sevBg[sev], sbr_=sevBorder[sev], sl_=sevLabel[sev];
        // Fotoğraf thumbnails — DOM oluşturma
        var photoRowHtml='';
        if(imgs.length){
          var thumbs='';
          imgs.forEach(function(src){
            var el=document.createElement('div');
            el.style.cssText='position:relative;flex-shrink:0;';
            var img=document.createElement('img');
            img.src=src;
            img.style.cssText='width:88px;height:88px;object-fit:cover;border-radius:6px;border:2px solid '+sc_+';cursor:zoom-in;display:block;';
            img.onclick=function(){ openPhotoFull(src); };
            el.appendChild(img);
            thumbs+=el.outerHTML;
          });
          photoRowHtml='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid '+sbr_+';">'+thumbs+'</div>';
        }
        var noteHtml=note?('<div style="margin-top:5px;font-size:11px;color:var(--text2);font-style:italic;">📝 '+note+'</div>'):'';
        // Aksiyon ekle butonu
        var _dAreaId=audit.area_id||'';
        var _dAreaName=(audit.area_name||'').replace(/'/g,'&#39;');
        var _dTitle=(p.id+' · S'+(qi+1)+' — '+q.text+' (Cevap: '+_answerLabel(q,ans)+')').replace(/'/g,'&#39;');
        var _dPrio=sev==='crit'?'Kritik':sev==='warn'?'Yüksek':'Orta';
        var addBtnHtml='<div style="margin-top:8px;text-align:right;">'
          +'<button onclick="openActionFromReport(\''+audit.id+'\',\''+_dAreaId+'\',\''+_dAreaName+'\',\''+_dTitle+'\',\''+_dPrio+'\')" '
          +'style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid '+sc_+';background:white;color:'+sc_+';cursor:pointer;font-weight:600;">➕ Aksiyon Ekle</button>'
          +'</div>';
        groupHtml+='<div style="margin-bottom:10px;border:1px solid '+sbr_+';border-left:4px solid '+sc_+';border-radius:0 var(--r) var(--r) 0;background:'+sb_+';overflow:hidden;">'
          +'<div style="padding:10px 12px;">'
          +'<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;">'
          +'<div style="width:20px;height:20px;border-radius:50%;background:'+sc_+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:1px;">'+sc+'</div>'
          +'<div style="flex:1;">'
          +'<div style="font-size:12px;font-weight:600;color:var(--text1);margin-bottom:3px;">S'+(qi+1)+'. '+q.text+'</div>'
          +'<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
          +'<span style="font-size:11px;background:'+sc_+';color:#fff;border-radius:4px;padding:1px 7px;font-weight:600;">'+sl_+'</span>'
          +'<span style="font-size:11px;color:var(--text2);">Cevap: <b>'+_answerLabel(q,ans)+'</b></span>'
          +'<span style="font-size:11px;color:var(--text3);">Puan: '+sc+'/4</span>'
          +'</div>'
          +noteHtml
          +'</div></div>'
          +photoRowHtml
          +addBtnHtml
          +'</div></div>';
      });
      findingsHtml+=groupHtml+'</div>';
    });
  }

  // Özet sayaç
  const critCount=findingGroups.reduce((t,g)=>t+g.items.filter(i=>i.severity==='crit').length,0);
  const warnCount=findingGroups.reduce((t,g)=>t+g.items.filter(i=>i.severity==='warn').length,0);
  const totalFindings=findingGroups.reduce((t,g)=>t+g.items.length,0);
  const photoCount=findingGroups.reduce((t,g)=>t+g.items.reduce((tt,i)=>tt+i.imgs.length,0),0);

  const html=`<div style="font-size:13px;line-height:1.6;">

    <!-- Başlık -->
    <div style="padding:16px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:var(--r);margin-bottom:16px;border:1px solid var(--border);text-align:center;">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">5S SEVİYESİ</div>
      <div style="font-size:56px;font-weight:800;font-family:var(--mono);color:${sLevelColor(calculateSLevel(audit))};line-height:1;">${formatSLevel(calculateSLevel(audit))}</div>
      <div style="font-size:11px;color:var(--text3);margin:2px 0 6px;">Toplam Puan: ${score}/100</div>
      <span class="badge ${sLevelBadge(calculateSLevel(audit))}" style="font-size:13px;padding:5px 16px;margin-top:6px;display:inline-block;">${sLevelLabel(calculateSLevel(audit))}</span>
    </div>

    <!-- Bilgi kartı -->
    <div style="padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--r);margin-bottom:16px;font-size:12px;color:#1e40af;">
      ℹ️ Bu rapor <b>${audit.area_name||'ilgili alan'}</b> için hazırlanmış bulgular özetidir.
      Toplam <b>${totalFindings}</b> iyileştirme noktası tespit edilmiş olup
      ${photoCount>0?`<b>${photoCount}</b> fotoğraf eklenmiştir.`:'fotoğraf eklenmemiştir.'}
    </div>

    <!-- Özet sayaçlar -->
    ${totalFindings>0?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
      <div style="text-align:center;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--r);">
        <div style="font-size:22px;font-weight:700;color:#ef4444;">${critCount}</div>
        <div style="font-size:10px;color:#b91c1c;font-weight:600;">Olumsuz</div>
      </div>
      <div style="text-align:center;padding:10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--r);">
        <div style="font-size:22px;font-weight:700;color:#f97316;">${warnCount}</div>
        <div style="font-size:10px;color:#c2410c;font-weight:600;">Geliştirilmeli</div>
      </div>
      <div style="text-align:center;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r);">
        <div style="font-size:22px;font-weight:700;color:#16a34a;">${photoCount}</div>
        <div style="font-size:10px;color:#15803d;font-weight:600;">Fotoğraf</div>
      </div>
    </div>`:''}

    <!-- Bulgular -->
    <div style="font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">🔎 Tespit Edilen Bulgular</div>
    ${findingsHtml}

    <div style="margin-top:16px;font-size:10px;color:var(--text3);text-align:center;border-top:1px solid var(--border);padding-top:10px;">
      Bulgular Raporu · ${new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'})} · Denetim No: ${audit.form_code||'—'}
    </div>
  </div>`;

  document.getElementById('ai-content').innerHTML=html;
  document.getElementById('ai-content').style.display='block';
  document.getElementById('pdf-btn').style.display='';
}

function exportPDF(){ window.print(); }

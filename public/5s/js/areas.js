// ============================================================
// areas.js — Alan yönetimi
// ============================================================

let _activeAreaId = null;

/**
 * Bölge yönetimi ekranının süzgeç durumu.
 *
 * Dört fabrikada 49 alan var; hepsini tek ızgarada göstermek aranılanı
 * bulmayı zorlaştırıyordu. Önce fabrika, sonra bölüm seçilir; arama kutusu
 * ikisinin üzerinde çalışır.
 */
const _areaFilter = { fabrika: 'Tümü', bolum: 'Tümü', arama: '' };

function _areaFabrika(area){ return area.fabrika || 'Diğer'; }
function _areaBolum(area){ return area.alt_dept || area.dept || 'Genel'; }

/** Seçili fabrikaya göre (arama hariç) aday alanlar — bölüm sayıları buradan. */
function _areasInFabrika(){
  return S.areas.filter(a => _areaFilter.fabrika === 'Tümü' || _areaFabrika(a) === _areaFilter.fabrika);
}

/** Ekranda gösterilecek alanlar: fabrika + bölüm + arama. */
function _filteredAreas(){
  const arama = _areaFilter.arama.trim().toLocaleLowerCase('tr');
  return _areasInFabrika().filter(a => {
    if(_areaFilter.bolum !== 'Tümü' && _areaBolum(a) !== _areaFilter.bolum) return false;
    if(!arama) return true;
    return [a.name, a.fabrika, a.dept, a.alt_dept]
      .filter(Boolean)
      .some(v => String(v).toLocaleLowerCase('tr').includes(arama));
  });
}

function setAreaFabrika(fabrika){
  _areaFilter.fabrika = fabrika;
  _areaFilter.bolum = 'Tümü';   // bölümler fabrikaya bağlı, seçim geçersizleşir
  renderAreas();
}

function setAreaBolum(bolum){
  _areaFilter.bolum = bolum;
  renderAreas();
}

function setAreaSearch(value){
  _areaFilter.arama = value;
  _renderAreaResults();   // süzgeç çubuğunu yeniden kurma, yazarken odak kaybolmasın
}

function clearAreaFilters(){
  _areaFilter.fabrika = 'Tümü';
  _areaFilter.bolum = 'Tümü';
  _areaFilter.arama = '';
  renderAreas();
}

function renderAreas(){
  _renderAreaFilters();
  _renderAreaResults();
}

/** Tek tırnak içeren fabrika/bölüm adları onclick metnini bozmasın. */
function _jsArg(value){
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Fabrika ve bölüm seçicileri; her seçenekte kaç alan olduğu yazar. */
function _renderAreaFilters(){
  const wrap = document.getElementById('area-filters');
  if(!wrap) return;

  const fabrikalar = [...new Set(S.areas.map(_areaFabrika))].sort((a,b)=>a.localeCompare(b,'tr'));
  const adaylar = _areasInFabrika();
  const bolumler = [...new Set(adaylar.map(_areaBolum))].sort((a,b)=>a.localeCompare(b,'tr'));

  const chip = (label, count, secili, onclick) =>
    `<button type="button" class="filter-chip${secili?' on':''}" onclick="${onclick}">`
    + `${label}<span class="chip-count">${count}</span></button>`;

  const fabrikaChips = chip('Tümü', S.areas.length, _areaFilter.fabrika==='Tümü', "setAreaFabrika('Tümü')")
    + fabrikalar.map(f => chip(
        '🏭 ' + f,
        S.areas.filter(a=>_areaFabrika(a)===f).length,
        _areaFilter.fabrika===f,
        "setAreaFabrika('" + _jsArg(f) + "')"
      )).join('');

  const bolumChips = chip('Tümü', adaylar.length, _areaFilter.bolum==='Tümü', "setAreaBolum('Tümü')")
    + bolumler.map(b => chip(
        b,
        adaylar.filter(a=>_areaBolum(a)===b).length,
        _areaFilter.bolum===b,
        "setAreaBolum('" + _jsArg(b) + "')"
      )).join('');

  wrap.innerHTML =
    '<div class="filter-row"><span class="filter-row-label">Fabrika</span>' + fabrikaChips + '</div>'
    + '<div class="filter-row"><span class="filter-row-label">Bölüm</span>' + bolumChips + '</div>'
    + '<div class="filter-row"><span class="filter-row-label">Ara</span>'
    + '<input type="text" class="area-search" id="area-search" placeholder="Alan adı..." '
    + 'value="' + escAttr(_areaFilter.arama) + '" oninput="setAreaSearch(this.value)"></div>';
}

/** Özet, sonuç satırı ve kartlar — hepsi süzülmüş listeye göre. */
function _renderAreaResults(){
  const areas = _filteredAreas();
  _renderAreasSummary(areas);

  const suzuluyor = _areaFilter.fabrika !== 'Tümü' || _areaFilter.bolum !== 'Tümü' || !!_areaFilter.arama.trim();

  const line = document.getElementById('area-result-line');
  if(line){
    line.innerHTML =
      '<span><b>' + areas.length + '</b> alan'
      + (suzuluyor ? ' <span style="color:var(--text3);">/ ' + S.areas.length + ' toplam</span>' : '')
      + '</span>'
      + (suzuluyor ? '<button type="button" class="filter-chip" onclick="clearAreaFilters()">✕ Filtreyi temizle</button>' : '');
  }

  const wrap = document.getElementById('area-groups');
  if(!wrap) return;

  if(!areas.length){
    wrap.innerHTML = '<div class="empty-state"><div style="font-size:3rem;">🔍</div>'
      + '<p>Bu filtreyle alan bulunamadı.</p>'
      + '<button class="btn btn-outline btn-sm" onclick="clearAreaFilters()">Filtreyi temizle</button></div>';
    return;
  }

  // Bölüme göre grupla: düz bir duvar yerine okunur başlıklar.
  const gruplar = new Map();
  areas.forEach(area => {
    const anahtar = _areaFilter.fabrika === 'Tümü'
      ? _areaFabrika(area) + ' · ' + _areaBolum(area)
      : _areaBolum(area);
    if(!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(area);
  });

  wrap.innerHTML = [...gruplar.entries()]
    .sort((a,b)=>a[0].localeCompare(b[0],'tr'))
    .map(([ad, grup]) =>
      '<div class="area-group"><div class="area-group-hdr">'
      + '<span class="area-group-name">' + ad + '</span>'
      + '<span class="area-group-sub">' + grup.length + ' alan</span></div>'
      + '<div class="area-grid">' + grup.map(_areaCardHtml).join('') + '</div></div>'
    ).join('');
}

/** Tek bir alan kartı. Sol kenar rengi son denetim puanını gösterir. */
function _areaCardHtml(area){
  const areaAudits = S.audits
    .filter(a=>a.area_id===area.id)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const last = areaAudits[0];
  const score = last ? Number(last.total_score) : null;
  const openActs = S.actions.filter(ac=>ac.area_id===area.id && ac.status!=='Tamamlandı').length;
  const durum = score===null ? 'sc-none' : score>=75 ? 'sc-hi' : score>=50 ? 'sc-md' : 'sc-lo';

  return `
    <div class="area-card ${durum}" onclick="openAreaDetail('${area.id}')">
      <div class="area-card-header">
        <div class="area-card-info">
          <div class="area-card-name">${area.name}</div>
          <div class="area-card-fab" style="font-size:11px;color:var(--text3);">${area.fabrika||''}${area.dept?' · '+area.dept:''}</div>
        </div>
        ${score!==null
          ? `<div class="badge ${scoreBadge(score)}" style="font-size:13px;padding:4px 10px;">${score}</div>`
          : '<div style="font-size:13px;color:var(--text3);">—</div>'}
      </div>
      <div class="area-card-meta" style="display:flex;gap:12px;font-size:11px;color:var(--text2);margin-top:8px;flex-wrap:wrap;">
        ${last
          ? `<span>📅 ${formatDate(last.date)}</span><span>${areaAudits.length} denetim</span>`
          : '<span class="area-card-none">Henüz denetim yok</span>'}
        ${openActs>0 ? `<span style="color:var(--amber);font-weight:600;">⚡ ${openActs} aksiyon</span>` : ''}
      </div>
    </div>`;
}

function _renderAreasSummary(areas){
  const wrap = document.getElementById('areas-summary');
  if(!wrap) return;
  const total = areas.length;
  const withAudit = areas.filter(a=>S.audits.some(au=>au.area_id===a.id)).length;
  const allScores = areas.map(a=>{
    const au = S.audits.filter(x=>x.area_id===a.id).sort((x,y)=>new Date(y.date)-new Date(x.date))[0];
    return au ? Number(au.total_score) : null;
  }).filter(v=>v!==null);
  const avg = allScores.length ? Math.round(allScores.reduce((s,v)=>s+v,0)/allScores.length) : 0;
  const pass = allScores.filter(v=>v>=75).length;

  wrap.innerHTML = `
    <div class="metric blue" style="padding:12px;"><div class="metric-label">Toplam Alan</div><div class="metric-val">${total}</div></div>
    <div class="metric green" style="padding:12px;"><div class="metric-label">Denetlenen</div><div class="metric-val">${withAudit}</div></div>
    <div class="metric amber" style="padding:12px;"><div class="metric-label">Ort. Puan</div><div class="metric-val">${avg||'—'}</div></div>
    <div class="metric" style="padding:12px;"><div class="metric-label">Geçer (≥75)</div><div class="metric-val">${pass}</div></div>
  `;
}

function openAreaDetail(areaId){
  _activeAreaId = areaId;
  const area = S.areas.find(a=>a.id===areaId);
  if(!area) return;

  const areaAudits = S.audits
    .filter(a=>a.area_id===areaId)
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const last = areaAudits[0];
  const allScores = areaAudits.map(a=>Number(a.total_score));
  const avgScore  = allScores.length ? Math.round(allScores.reduce((s,v)=>s+v,0)/allScores.length) : null;
  const openActs  = S.actions.filter(ac=>ac.area_id===areaId && ac.status!=='Tamamlandı');

  // Pillar ortalamaları
  const pillarBars = PILLARS.map((p,pi)=>{
    const vals = areaAudits
      .map(a=>{
        const pils = Array.isArray(a.pillars_json)
          ? a.pillars_json
          : (a.pillars_json ? Object.values(a.pillars_json) : []);
        const pData = pils[pi];
        return pData?.pct ?? pData?.score ?? null;
      })
      .filter(v=>v!=null);
    const sc = vals.length ? Math.round(vals.reduce((s,v)=>s+Number(v),0)/vals.length) : null;
    return `
      <div style="display:grid;grid-template-columns:110px 1fr 36px;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:11px;color:var(--text2);">${p.name}</span>
        <div style="height:7px;background:var(--surface2);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${sc||0}%;background:var(--${sc!=null&&sc>=75?'green':sc!=null&&sc>=50?'amber':'red'});border-radius:4px;transition:width .4s;"></div>
        </div>
        <span style="font-size:12px;font-weight:600;text-align:right;">${sc!=null?sc:'—'}</span>
      </div>
    `;
  }).join('');

  const recentAudits = areaAudits.slice(0,5).map(a=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;">${new Date(a.date).toLocaleDateString('tr-TR')} · ${a.auditor_name||'—'}</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <span class="badge ${scoreBadge(a.total_score||0)}" style="font-size:11px;">${a.total_score}</span>
        <button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:10px;" onclick="showDetail('${a.id}')">Detay</button>
      </div>
    </div>
  `).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Henüz denetim yok</div>';

  const actionRows = openActs.slice(0,5).map(ac=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border);">
      <span style="width:8px;height:8px;border-radius:50%;background:var(--${ac.priority==='Kritik'||ac.priority==='Yüksek'?'red':'amber'});flex-shrink:0;"></span>
      <span style="flex:1;">${ac.description||'—'}</span>
      <span style="color:var(--text3);">${ac.status}</span>
    </div>
  `).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Açık aksiyon yok</div>';

  // Populate modal elements
  const nameEl = document.getElementById('detail-area-name');
  if(nameEl) nameEl.textContent = area.name;
  const subEl = document.getElementById('detail-area-sub');
  if(subEl) subEl.textContent = `${area.fabrika||''} ${area.dept?'· '+area.dept:''} ${area.alt_dept?'· '+area.alt_dept:''}`;
  const skorEl = document.getElementById('detail-skor');
  if(skorEl){ skorEl.textContent = avgScore!==null ? avgScore : '—'; skorEl.style.color = avgScore!==null ? (avgScore>=75?'var(--green)':avgScore>=50?'var(--amber)':'var(--red)') : 'var(--text3)'; }

  const metricsEl = document.getElementById('detail-metrics');
  if(metricsEl) metricsEl.innerHTML = `
    <div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--rs);">
      <div style="font-size:18px;font-weight:700;">${areaAudits.length}</div>
      <div style="font-size:10px;color:var(--text3);">Denetim</div>
    </div>
    <div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--rs);">
      <div style="font-size:18px;font-weight:700;color:var(--amber);">${openActs.length}</div>
      <div style="font-size:10px;color:var(--text3);">Açık Aksiyon</div>
    </div>
    <div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--rs);">
      <div style="font-size:14px;font-weight:600;">${last ? new Date(last.date).toLocaleDateString('tr-TR') : '—'}</div>
      <div style="font-size:10px;color:var(--text3);">Son Denetim</div>
    </div>
  `;

  const pillarEl = document.getElementById('detail-pillars');
  if(pillarEl) pillarEl.innerHTML = pillarBars;
  const auditsEl = document.getElementById('detail-audits');
  if(auditsEl) auditsEl.innerHTML = recentAudits;
  const actsEl = document.getElementById('detail-actions-list');
  if(actsEl) actsEl.innerHTML = actionRows;

  // Buton işlemleri
  const denetleBtn = document.getElementById('detail-denetle-btn');
  if(denetleBtn){
    denetleBtn.onclick = ()=>{
      window._aktifAtama = { atamaId:null, alanId:area.id, alanAd:area.name };
      closeModal('modal-area-detail');
      navigate('new-audit');
    };
    denetleBtn.style.display = (CURRENT_USER?.role==='takimlider'||CURRENT_USER?.role==='departman') ? 'none' : '';
  }

  const qrBtn = document.getElementById('detail-qr-btn');
  if(qrBtn){
    qrBtn.onclick = ()=>{
      const url = window.location.origin + window.location.pathname + '?area=' + area.id;
      if(window.QRCode){
        const tempDiv = document.createElement('div');
        document.body.appendChild(tempDiv);
        const qrObj = new QRCode(tempDiv, { text:url, width:256, height:256 });
        setTimeout(()=>{
          const canvas = tempDiv.querySelector('canvas');
          if(canvas){ const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=`QR-${area.name}.png`; a.click(); }
          document.body.removeChild(tempDiv);
        }, 300);
      }
    };
  }

  const delBtn = document.getElementById('detail-del-btn');
  if(delBtn){
    delBtn.style.display = CURRENT_USER?.role==='admin' ? '' : 'none';
    delBtn.onclick = ()=>delArea(area.id);
  }

  const histBtn = document.getElementById('detail-history-btn');
  if(histBtn) histBtn.onclick = ()=>{ closeModal('modal-area-detail'); navigate('history'); };

  openModal('modal-area-detail');
}

async function addArea(){
  const name    = document.getElementById('new-area-name')?.value.trim();
  const fabrika = document.getElementById('new-area-fabrika')?.value.trim();
  const dept    = document.getElementById('new-area-dept')?.value.trim();
  const desc    = document.getElementById('new-area-desc')?.value.trim();

  if(!name){ showToast('Alan adı zorunlu.'); return; }

  const body = { id: name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'') + '-' + Date.now(), name, fabrika, dept, description:desc };
  const result = await apiFetch('/areas', { method:'POST', body:JSON.stringify(body) });
  if(result){
    S.areas.push(result);
    closeModal('modal-area-add');
    renderAreas();
    showToast('Alan eklendi.');
    // Formu temizle
    ['new-area-name','new-area-dept','new-area-desc'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  }
}

// Alan silmek denetimleri SİLMEZ; denetimlerin alan bağlantısını koparır
// (ON DELETE SET NULL). Sunucu, kayıtlı denetim varsa 409 döner ve ikinci onay
// istenir. Eskiden ilk onaydan sonra denetimler ekrandan da düşürüldüğü için
// "denetimler silindi" görüntüsü oluşuyordu.
async function delArea(id){
  if(!confirm('Bu alanı silmek istediğinizden emin misiniz?')) return;
  try {
    await _deleteAreaRequest(id, false);
  } catch(err){
    if(!confirm(err.message + '\n\nYine de silinsin mi?')) return;
    try { await _deleteAreaRequest(id, true); }
    catch(err2){ showToast('⚠ '+err2.message); return; }
  }
  S.areas = S.areas.filter(a=>a.id!==id);
  closeModal('modal-area-detail');
  renderAreas();
  showToast('Alan silindi. Bu alandaki denetimler kayıtta duruyor.');
}

async function _deleteAreaRequest(id, force){
  return apiFetch(`/areas/${id}` + (force?'?force=1':''), { method:'DELETE' });
}

function showAreaHistory(areaId){
  openAreaDetail(areaId);
}

// ============================================================
// areas.js — Alan yönetimi
// ============================================================

let _activeAreaId = null;

function renderAreas(){
  const grid = document.getElementById('area-grid');
  if(!grid) return;

  // Backend zaten fabrika+dept filtreli veri gönderiyor — S.areas doğru
  const areas = [...S.areas];

  // Özet satırı
  _renderAreasSummary(areas);

  if(!areas.length){
    grid.innerHTML='<div class="empty-state"><div style="font-size:3rem;">🏭</div><p>Henüz alan tanımlanmamış.</p></div>';
    return;
  }

  const baseUrl = window.location.origin + window.location.pathname;

  grid.innerHTML = areas.map(area=>{
    const areaAudits = S.audits.filter(a=>a.area_id===area.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const last  = areaAudits[0];
    const score = last ? Number(last.total_score) : null;
    const openActs = S.actions.filter(ac=>ac.area_id===area.id && ac.status!=='Tamamlandı').length;

    return `
      <div class="area-card" onclick="openAreaDetail('${area.id}')">
        <div class="area-card-header">
          <div class="area-card-info">
            <div class="area-card-name">${area.name}</div>
            <div class="area-card-fab" style="font-size:11px;color:var(--text3);">${area.fabrika||''} ${area.dept?'· '+area.dept:''}</div>
          </div>
          ${score!==null
            ? `<div class="badge ${scoreBadge(score)}" style="font-size:13px;padding:4px 10px;">${score}</div>`
            : '<div style="font-size:13px;color:var(--text3);">—</div>'}
        </div>
        <div class="area-card-meta" style="display:flex;gap:12px;font-size:11px;color:var(--text2);margin-top:8px;flex-wrap:wrap;">
          <span>📅 ${last ? new Date(last.date).toLocaleDateString('tr-TR') : 'Henüz denetim yok'}</span>
          ${openActs>0 ? `<span style="color:var(--amber);font-weight:600;">⚡ ${openActs} aksiyon</span>` : ''}
          <span>${areaAudits.length} denetim</span>
        </div>
      </div>
    `;
  }).join('');
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

async function delArea(id){
  if(!confirm('Bu alanı ve ilgili tüm denetimleri silmek istediğinizden emin misiniz?')) return;
  const ok = await apiFetch(`/areas/${id}`, { method:'DELETE' });
  if(ok!==null){
    S.areas = S.areas.filter(a=>a.id!==id);
    S.audits = S.audits.filter(a=>a.area_id!==id);
    closeModal('modal-area-detail');
    renderAreas();
    showToast('Alan silindi.');
  }
}

function showAreaHistory(areaId){
  openAreaDetail(areaId);
}

// ============================================================
// actions.js — Aksiyon takibi
// ============================================================

function renderActions(){
  const tbody = document.getElementById('actions-tbody');
  if(!tbody) return;

  const user = CURRENT_USER;
  let actions = [...S.actions];

  if(user?.role==='departman'||user?.role==='takimlider'){
    actions = actions.filter(a=>a.area_fabrika===user.fabrika);
  }

  // Filtre
  const statusFilter = document.getElementById('act-filter')?.value||'all';
  if(statusFilter!=='all') actions = actions.filter(a=>a.status===statusFilter);

  // Özet metrikleri güncelle
  _updateActionMetrics(actions);

  const canEdit = user?.role==='admin'||user?.role==='denetci';
  const canDel  = user?.role==='admin';

  // Add buton görünürlüğü
  const addBtn = document.querySelector('#page-actions .btn-primary');
  if(addBtn) addBtn.style.display = canEdit ? '' : 'none';

  if(!actions.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:28px;">Aksiyon bulunamadı</td></tr>';
    return;
  }

  const priColor = {'Kritik':'var(--red)','Yüksek':'var(--amber)','Orta':'var(--brand)','Düşük':'var(--green)'};

  tbody.innerHTML = actions.map((ac,i)=>{
    const dueDateStr = ac.due_date ? new Date(ac.due_date).toLocaleDateString('tr-TR') : '—';
    const overdue = ac.due_date && ac.status!=='Tamamlandı' && new Date(ac.due_date)<new Date();
    return `
      <tr>
        <td style="color:var(--text3);">${i+1}</td>
        <td style="font-size:12px;max-width:200px;">${ac.description||'—'}</td>
        <td style="font-size:12px;">${ac.area_name||ac.area_id||'—'}</td>
        <td style="font-size:12px;">${ac.assigned_to||'—'}</td>
        <td><span style="font-size:11px;font-weight:600;color:${priColor[ac.priority]||'inherit'};">${ac.priority||'—'}</span></td>
        <td style="font-size:12px;color:${overdue?'var(--red)':'inherit'};">${dueDateStr}${overdue?' ⚠️':''}</td>
        <td>
          ${canEdit
            ? `<select style="font-size:11px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);" onchange="updateActStatus('${ac.id}',this.value)">
                <option value="Açık"${ac.status==='Açık'?' selected':''}>⏳ Açık</option>
                <option value="Devam Ediyor"${ac.status==='Devam Ediyor'?' selected':''}>🔄 Devam</option>
                <option value="Tamamlandı"${ac.status==='Tamamlandı'?' selected':''}>✅ Tamam</option>
               </select>`
            : `<span style="font-size:11px;">${ac.status}</span>`}
        </td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;">
          ${canEdit?`<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:10px;" onclick="openEditActionModal('${ac.id}')">✏️</button>`:''}
          ${canDel?`<button class="btn btn-sm" style="padding:2px 8px;font-size:10px;color:var(--red);border:1px solid var(--red);background:var(--red-light);" onclick="delAction('${ac.id}')">🗑️</button>`:''}
        </td>
      </tr>
    `;
  }).join('');
}

function _updateActionMetrics(actions){
  const kritik  = actions.filter(a=>a.priority==='Kritik' && a.status!=='Tamamlandı').length;
  const yuksek  = actions.filter(a=>a.priority==='Yüksek' && a.status!=='Tamamlandı').length;
  const orta    = actions.filter(a=>a.priority==='Orta'   && a.status!=='Tamamlandı').length;
  const done    = actions.filter(a=>a.status==='Tamamlandı').length;
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('act-kritik', kritik);
  set('act-yuksek', yuksek);
  set('act-orta',   orta);
  set('act-done',   done);
}

let _actionSaving = false;

// Add action form — called from modal-action-add
async function addAction(){
  if(_actionSaving) return;
  const title     = document.getElementById('na-title')?.value.trim();
  const area_id   = document.getElementById('na-area')?.value;
  const assigned  = document.getElementById('na-owner')?.value.trim();
  const priority  = document.getElementById('na-prio')?.value || 'Orta';
  const due_date  = document.getElementById('na-due')?.value;
  const desc      = document.getElementById('na-desc')?.value.trim();

  if(!title){ showToast('Başlık zorunlu.'); return; }

  const area = S.areas.find(a=>a.id===area_id);
  const body = {
    description: title + (desc ? '\n' + desc : ''),
    audit_id:    _currentAuditId||null,
    area_id:     area_id||null,
    area_name:   area?.name||'',
    assigned_to: assigned||'',
    due_date:    due_date||null,
    status:      'Açık',
    priority,
  };

  _actionSaving = true;
  const saveBtn = document.getElementById('action-save-btn');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Kaydediliyor...'; }
  try {
    const result = await apiFetch('/actions', { method:'POST', body:JSON.stringify(body) });
    if(result){
      S.actions.unshift(result);
      closeModal('modal-action-add');
      renderActions();
      updateBadges();
      showToast('Aksiyon eklendi.');
      ['na-title','na-owner','na-due','na-desc'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    }
  } finally {
    _actionSaving = false;
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Kaydet'; }
  }
}

let _editActionId = null;
let _currentAuditId = null;

function openEditActionModal(id){
  const ac = S.actions.find(a=>a.id===id);
  if(!ac) return;
  _editActionId = id;

  // Alanları doldur
  const titleEl = document.getElementById('na-title');
  if(titleEl) titleEl.value = ac.description||'';
  const ownerEl = document.getElementById('na-owner');
  if(ownerEl) ownerEl.value = ac.assigned_to||'';
  const prioEl = document.getElementById('na-prio');
  if(prioEl) prioEl.value = ac.priority||'Orta';
  const dueEl = document.getElementById('na-due');
  if(dueEl) dueEl.value = ac.due_date ? ac.due_date.split('T')[0] : '';
  const descEl = document.getElementById('na-desc');
  if(descEl) descEl.value = '';

  // Area
  const areaSel = document.getElementById('na-area');
  if(areaSel){
    _fillActionAreaSelect(areaSel, ac.area_id);
  }

  // Butonun etiketi değiştir
  const modalTitle = document.querySelector('#modal-action-add .modal-title');
  if(modalTitle) modalTitle.textContent = 'Aksiyonu Düzenle';

  openModal('modal-action-add');
}

function _fillActionAreaSelect(sel, selectedId=''){
  if(!sel) return;
  sel.innerHTML = '<option value="">— Alan seçin —</option>' +
    S.areas.map(a=>`<option value="${a.id}"${a.id===selectedId?' selected':''}>${a.name}${a.fabrika?' ('+a.fabrika+')':''}</option>`).join('');
}

async function saveEditAction(){
  if(_actionSaving) return;
  if(!_editActionId){ await addAction(); return; }
  const ac = S.actions.find(a=>a.id===_editActionId);
  if(!ac) return;

  const title    = document.getElementById('na-title')?.value.trim();
  const area_id  = document.getElementById('na-area')?.value;
  const assigned = document.getElementById('na-owner')?.value.trim();
  const priority = document.getElementById('na-prio')?.value||'Orta';
  const due_date = document.getElementById('na-due')?.value;
  const area     = S.areas.find(a=>a.id===area_id);

  const body = {
    description: title,
    area_id:     area_id||null,
    area_name:   area?.name||ac.area_name||'',
    assigned_to: assigned||'',
    due_date:    due_date||null,
    status:      ac.status,
    priority,
  };

  _actionSaving = true;
  const saveBtn = document.getElementById('action-save-btn');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Kaydediliyor...'; }
  try {
    const result = await apiFetch(`/actions/${_editActionId}`, { method:'PUT', body:JSON.stringify(body) });
    if(result){
      S.actions = S.actions.map(a=>a.id===_editActionId?result:a);
      _editActionId = null;
      closeModal('modal-action-add');
      renderActions();
      showToast('Aksiyon güncellendi.');
      const mt = document.querySelector('#modal-action-add .modal-title');
      if(mt) mt.textContent = 'Yeni Aksiyon';
    }
  } finally {
    _actionSaving = false;
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='Kaydet'; }
  }
}

async function updateActStatus(id, status){
  const ac = S.actions.find(a=>a.id===id);
  if(!ac) return;
  const result = await apiFetch(`/actions/${id}`, {
    method:'PUT',
    body: JSON.stringify({ ...ac, status })
  });
  if(result){
    S.actions = S.actions.map(a=>a.id===id?result:a);
    renderActions();
    updateBadges();
  }
}

async function delAction(id){
  if(!confirm('Bu aksiyonu silmek istediğinizden emin misiniz?')) return;
  const ok = await apiFetch(`/actions/${id}`, { method:'DELETE' });
  if(ok!==null){
    S.actions = S.actions.filter(a=>a.id!==id);
    renderActions();
    updateBadges();
    showToast('Aksiyon silindi.');
  }
}

// modal-action-add açılınca alan listesini doldur
function initActionModal(){
  _editActionId = null;
  _currentAuditId = null;
  const areaSel = document.getElementById('na-area');
  if(areaSel) _fillActionAreaSelect(areaSel);
  const mt = document.querySelector('#modal-action-add .modal-title');
  if(mt) mt.textContent = 'Yeni Aksiyon';
}

// Rapor içinden aksiyon ekle — modal-ai kapanır, aksiyon formu önceden dolu açılır
function openActionFromReport(auditId, areaId, areaName, title, priority){
  closeModal('modal-ai');
  _editActionId = null;
  _currentAuditId = auditId || null;

  // Başlık
  const titleEl = document.getElementById('na-title');
  if(titleEl) titleEl.value = title || '';

  // Alan
  const areaSel = document.getElementById('na-area');
  if(areaSel) _fillActionAreaSelect(areaSel, areaId);

  // Öncelik
  const prioEl = document.getElementById('na-prio');
  if(prioEl) prioEl.value = priority || 'Yüksek';

  // Diğer alanları temizle
  const ownerEl = document.getElementById('na-owner');
  if(ownerEl) ownerEl.value = '';
  const dueEl = document.getElementById('na-due');
  if(dueEl) dueEl.value = '';
  const descEl = document.getElementById('na-desc');
  if(descEl) descEl.value = '';

  // Modal başlığı
  const mt = document.querySelector('#modal-action-add .modal-title');
  if(mt) mt.textContent = 'Yeni Aksiyon';

  openModal('modal-action-add');
}

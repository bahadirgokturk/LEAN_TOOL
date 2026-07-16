// ============================================================
// users.js — Kullanıcı yönetimi (sadece admin)
// ============================================================

function renderKullanicilar(){
  const wrap = document.getElementById('kullanici-list');
  if(!wrap) return;

  const roleLabel = {admin:'👑 Yönetici',denetci:'🔍 Denetçi',takimlider:'👔 Takım Lideri',departman:'🏭 Departman'};
  const roleBadge = {admin:'role-admin',denetci:'role-denetci',takimlider:'role-takimlider',departman:'role-takimlider'};

  if(!S.users.length){
    wrap.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);">Kullanıcı bulunamadı.</div>';
    return;
  }

  wrap.innerHTML = S.users.map(u=>`
    <div style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">
        ${(u.name||'?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;">${u.name||'—'}</div>
        <div style="font-size:11px;color:var(--text3);">@${u.username} ${u.fabrika?'· '+u.fabrika:''} ${u.dept?'· '+u.dept:''}</div>
      </div>
      <span class="role-badge ${roleBadge[u.role]||''}">${roleLabel[u.role]||u.role}</span>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm btn-outline" onclick="openEditUserModal('${u.id}')">✏️</button>
        <button class="btn btn-sm btn-outline" onclick="resetUserPass('${u.id}')" title="Şifre Değiştir">🔑</button>
        ${u.id!==CURRENT_USER?.id
          ? `<button class="btn btn-sm" style="color:var(--red);border:1px solid var(--red);background:var(--red-light);" onclick="delUser('${u.id}')">🗑️</button>`
          : ''}
      </div>
    </div>
  `).join('');
}

// Yeni kullanıcı — modal-user-add formu
async function addUser(){
  const name     = document.getElementById('nu-name')?.value.trim();
  const username = document.getElementById('nu-username')?.value.trim();
  const password = document.getElementById('nu-password')?.value;
  const role     = document.getElementById('nu-role')?.value||'denetci';
  const fabrika  = document.getElementById('nu-fabrika')?.value.trim();
  const dept     = document.getElementById('nu-dept')?.value.trim();

  if(!name||!username){ showToast('Ad ve kullanıcı adı zorunlu.'); return; }
  if(!password){ showToast('Şifre zorunlu.'); return; }
  if(password.length<6){ showToast('Şifre en az 6 karakter olmalıdır.'); return; }

  const body = { name, username, password, role, fabrika, dept };
  const result = await apiFetch('/users', { method:'POST', body:JSON.stringify(body) });
  if(result){
    S.users.push(result);
    closeModal('modal-user-add');
    renderKullanicilar();
    showToast('Kullanıcı eklendi.');
    ['nu-name','nu-username','nu-password'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  }
}

function openEditUserModal(id){
  const u = S.users.find(u=>u.id===id);
  if(!u) return;

  // modal-user-add kullanıyoruz (tek form), başlığı değiştir
  const titleEl = document.querySelector('#modal-user-add .modal-title');
  if(titleEl) titleEl.textContent = 'Kullanıcıyı Düzenle';

  document.getElementById('nu-name').value     = u.name||'';
  document.getElementById('nu-username').value = u.username||'';
  document.getElementById('nu-password').value = '';
  document.getElementById('nu-role').value     = u.role||'denetci';
  document.getElementById('nu-fabrika').value  = u.fabrika||'';
  document.getElementById('nu-dept').value     = u.dept||'';

  // Şifre alanını isteğe bağlı yap
  const pwLabel = document.getElementById('nu-password-label');
  if(pwLabel) pwLabel.textContent = 'Yeni Şifre (boş bırakılabilir)';
  document.getElementById('nu-password')?.setAttribute('placeholder','Değiştirmek istemiyorsanız boş bırakın');

  // Kaydet butonunu güncelle
  const saveBtn = document.querySelector('#modal-user-add .btn-primary');
  if(saveBtn){
    saveBtn.onclick = ()=>saveEditUser(id);
    saveBtn.textContent = '✓ Güncelle';
  }

  openModal('modal-user-add');
}

async function saveEditUser(id){
  const name     = document.getElementById('nu-name')?.value.trim();
  const username = document.getElementById('nu-username')?.value.trim();
  const password = document.getElementById('nu-password')?.value;
  const role     = document.getElementById('nu-role')?.value||'denetci';
  const fabrika  = document.getElementById('nu-fabrika')?.value.trim();
  const dept     = document.getElementById('nu-dept')?.value.trim();

  if(!name||!username){ showToast('Ad ve kullanıcı adı zorunlu.'); return; }

  const body = { name, username, role, fabrika, dept };
  if(password) body.password = password;

  const result = await apiFetch(`/users/${id}`, { method:'PUT', body:JSON.stringify(body) });
  if(result){
    S.users = S.users.map(u=>u.id===id?result:u);
    closeModal('modal-user-add');
    renderKullanicilar();
    showToast('Kullanıcı güncellendi.');
    _resetUserModalButtons();
  }
}

function _resetUserModalButtons(){
  const titleEl = document.querySelector('#modal-user-add .modal-title');
  if(titleEl) titleEl.textContent = 'Yeni Kullanıcı Ekle';
  const saveBtn = document.querySelector('#modal-user-add .btn-primary');
  if(saveBtn){
    saveBtn.onclick = addUser;
    saveBtn.textContent = 'Kaydet';
  }
  const pwLabel = document.getElementById('nu-password-label');
  if(pwLabel) pwLabel.textContent = 'Şifre *';
  document.getElementById('nu-password')?.setAttribute('placeholder','Şifre belirle');
}

function resetUserPass(id){
  const u = S.users.find(u=>u.id===id);
  if(!u){ showToast('Kullanıcı bulunamadı.'); return; }
  // Modal alanlarını doldur
  const nameEl = document.getElementById('rp-user-name');
  if(nameEl) nameEl.textContent = u.name + ' (@' + u.username + ')';
  const idEl = document.getElementById('rp-user-id');
  if(idEl) idEl.value = id;
  const pw1 = document.getElementById('rp-password');
  const pw2 = document.getElementById('rp-password2');
  if(pw1) pw1.value = '';
  if(pw2) pw2.value = '';
  openModal('modal-reset-pass');
}

async function saveResetPass(){
  const id  = document.getElementById('rp-user-id')?.value;
  const pw  = document.getElementById('rp-password')?.value;
  const pw2 = document.getElementById('rp-password2')?.value;
  if(!id){ showToast('Kullanıcı bulunamadı.'); return; }
  if(!pw || pw.length<6){ showToast('Şifre en az 6 karakter olmalıdır.'); return; }
  if(pw !== pw2){ showToast('Şifreler eşleşmiyor.'); return; }
  const u = S.users.find(u=>u.id===id);
  if(!u){ showToast('Kullanıcı bulunamadı.'); return; }
  const btn = document.getElementById('rp-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Kaydediliyor...'; }
  try {
    const result = await apiFetch(`/users/${id}`, {
      method:'PUT',
      body: JSON.stringify({ name:u.name, username:u.username, role:u.role, dept:u.dept, fabrika:u.fabrika, bolum:u.bolum, password:pw })
    });
    if(result){
      closeModal('modal-reset-pass');
      showToast('✅ Şifre güncellendi.');
    }
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='🔑 Güncelle'; }
  }
}

async function delUser(id){
  if(id===CURRENT_USER?.id){ showToast('Kendi hesabınızı silemezsiniz.'); return; }
  if(!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
  const ok = await apiFetch(`/users/${id}`, { method:'DELETE' });
  if(ok!==null){
    S.users = S.users.filter(u=>u.id!==id);
    renderKullanicilar();
    showToast('Kullanıcı silindi.');
  }
}

function updateBolumSelect(){
  // Legacy function — no-op in new arch (fabrika/dept always visible in HTML)
}

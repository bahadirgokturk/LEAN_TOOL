// ============================================================
// init.js — Uygulama başlatma
// ============================================================

document.addEventListener('DOMContentLoaded', async ()=>{

  // ── Modal overlay tıklamayla kapanma ───────────────────────
  document.querySelectorAll('.modal-ov').forEach(overlay=>{
    overlay.addEventListener('click', e=>{
      if(e.target===overlay) closeModal(overlay.id);
    });
  });

  // ── Escape tuşu ile modal kapatma ──────────────────────────
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      const open = document.querySelector('.modal-ov.open');
      if(open) closeModal(open.id);
    }
  });

  // ── Login formu Enter tuşu ──────────────────────────────────
  document.getElementById('login-username')?.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('login-password')?.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

  // ── modal-action-add açılırken alan listesini doldur ────────
  document.getElementById('modal-action-add')?.addEventListener('click', e=>{
    if(e.target===document.getElementById('modal-action-add')){
      // overlay tıklaması — zaten yukarıda handle ediliyor
      return;
    }
  });

  // ── modal-user-add kapatıldığında butonları sıfırla ────────
  const userModal = document.getElementById('modal-user-add');
  if(userModal){
    const obs = new MutationObserver(()=>{
      // Modal class bazlı açılıp kapanıyor ('open' class eklenir/kaldırılır)
      if(!userModal.classList.contains('open')){
        const saveBtn = userModal.querySelector('.btn-primary');
        if(saveBtn && saveBtn.textContent.includes('Güncelle')){
          _resetUserModalButtons();
        }
      }
    });
    obs.observe(userModal, { attributes:true, attributeFilter:['class'] });
  }

  // ── QR otomatik başlatma ────────────────────────────────────
  checkQRAutostart();

  // ── Oturum kontrolü ─────────────────────────────────────────
  await checkSession();
});

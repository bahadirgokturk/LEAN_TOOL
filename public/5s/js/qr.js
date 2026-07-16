// ============================================================
// qr.js — QR kod oluşturma ve yazdırma (4-tip sistemi)
// ============================================================

let _qrInstances = {};
let _qrBaseUrl   = '';  // Kullanıcı tarafından ayarlanabilir

// 4 form tipine ait sabit QR listesi
const QR_TIPLER = [
  { tip:'uretim',    adi:'Üretim',        icon:'🏭', renk:'#c0392b', desc:'Tüm üretim hatları ve atölye alanları' },
  { tip:'operasyon', adi:'Operasyon',      icon:'⚙️', renk:'#16a085', desc:'Bakım, planlama ve depo alanları' },
  { tip:'ofis',      adi:'Ofis',           icon:'🏢', renk:'#8e44ad', desc:'İdari ve ofis çalışma alanları' },
  { tip:'kalite',    adi:'Kalite Kontrol', icon:'🔍', renk:'#2980b9', desc:'Kalite kontrol ve muayene alanları' },
];

async function renderQRPage(){
  const wrap = document.getElementById('qr-grid');
  if(!wrap) return;
  _qrInstances = {};

  // Filtre çubuğu → ağ URL ayar paneli
  const filterBar = document.getElementById('qr-filter-bar');

  // HTTPS (production) ortamında localStorage'daki eski local URL'yi temizle
  const cachedUrl = localStorage.getItem('qr_base_url') || '';
  if(cachedUrl && cachedUrl.startsWith('http://') && window.location.protocol === 'https:'){
    localStorage.removeItem('qr_base_url');
  }

  // Sunucu ağ IP'sini al
  let networkUrl = localStorage.getItem('qr_base_url') || '';
  if(!networkUrl){
    try {
      const info = await fetch('/api/s5/server-info').then(r=>r.json());
      networkUrl = info.networkUrl || window.location.origin + '/5s/';
    } catch(e){
      networkUrl = window.location.origin + '/5s/';
    }
    localStorage.setItem('qr_base_url', networkUrl);
  }
  _qrBaseUrl = networkUrl;

  if(filterBar){
    filterBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:4px;">
        <span style="font-size:12px;font-weight:600;color:var(--text2);flex-shrink:0;">📡 Ağ Adresi:</span>
        <input id="qr-base-input" type="text" value="${_qrBaseUrl}"
          style="flex:1;min-width:220px;font-size:12px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-family:var(--mono);"
          placeholder="http://192.168.x.x:3001">
        <button class="btn btn-primary btn-sm" onclick="applyQRBaseUrl()" style="flex-shrink:0;">🔄 Yenile</button>
        <span style="font-size:10px;color:var(--text3);">Telefonun aynı Wi-Fi'a bağlı olması gerekir</span>
      </div>`;
  }

  _renderQRCards();
}

function _renderQRCards(){
  const wrap = document.getElementById('qr-grid');
  if(!wrap) return;
  const baseUrl = _qrBaseUrl || window.location.origin + '/5s/';

  wrap.innerHTML = QR_TIPLER.map(t=>`
    <div class="qr-card" id="qr-card-${t.tip}" style="border-top:4px solid ${t.renk};">
      <div style="font-size:28px;margin-bottom:6px;">${t.icon}</div>
      <div class="qr-area-name" style="font-size:16px;color:${t.renk};">${t.adi}</div>
      <div class="qr-area-sub" style="font-size:11px;color:var(--text3);margin-bottom:8px;">${t.desc}</div>
      <div class="qr-code-wrap" id="qr-${t.tip}"></div>
      <div class="qr-url" style="font-size:9px;">${baseUrl}?form=${t.tip}</div>
      <div class="qr-card-actions" style="display:flex;gap:8px;justify-content:center;">
        <button class="btn btn-sm btn-secondary" onclick="downloadQR('${t.tip}','${t.adi}')">⬇️ İndir</button>
        <button class="btn btn-sm btn-outline" onclick="printSingleQR('${t.tip}','${t.adi}')">🖨️ Yazdır</button>
      </div>
    </div>
  `).join('');

  // QR kodları üret
  requestAnimationFrame(()=>{
    QR_TIPLER.forEach(t=>{
      const el = document.getElementById('qr-'+t.tip);
      if(!el || !window.QRCode) return;
      el.innerHTML = '';
      try {
        _qrInstances[t.tip] = new QRCode(el, {
          text: `${baseUrl}?form=${t.tip}`,
          width: 160, height: 160,
          colorDark: t.renk,
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch(e){ el.textContent = 'QR hatası: '+e.message; }
    });
  });
}

function applyQRBaseUrl(){
  const input = document.getElementById('qr-base-input');
  if(!input) return;
  let val = input.value.trim().replace(/\/$/, ''); // trailing slash kaldır
  if(!val){ showToast('Geçerli bir URL girin.'); return; }
  _qrBaseUrl = val;
  localStorage.setItem('qr_base_url', val);
  _renderQRCards();
  showToast('✅ QR adres güncellendi: ' + val);
}

function downloadQR(tip, adi){
  const el = document.getElementById('qr-'+tip);
  if(!el) return;
  const canvas = el.querySelector('canvas');
  const img    = el.querySelector('img');
  if(canvas){
    const link = document.createElement('a');
    link.download = 'QR-' + adi + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } else if(img){
    const link = document.createElement('a');
    link.download = 'QR-' + adi + '.png';
    link.href = img.src;
    link.click();
  } else {
    showToast('QR henüz oluşturulmadı.');
  }
}

function printSingleQR(tip, adi){
  const baseUrl = (_qrBaseUrl || window.location.origin + '/5s/');
  const t = QR_TIPLER.find(x=>x.tip===tip);
  if(!t) return;
  const win = window.open('', '_blank', 'width=400,height=500');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>QR — ${t.adi}</title>
    <style>
      body{font-family:sans-serif;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;}
      .icon{font-size:36px;margin-bottom:8px;}
      .adi{font-size:22px;font-weight:700;color:${t.renk};margin-bottom:4px;}
      .desc{font-size:12px;color:#666;margin-bottom:16px;}
      .url{font-size:9px;color:#999;margin-top:8px;word-break:break-all;max-width:220px;text-align:center;}
      @media print{body{margin:0;}}
    </style>
    <script src="/js/qrcode.min.js"><\/script>
  </head><body>
    <div class="icon">${t.icon}</div>
    <div class="adi">${t.adi}</div>
    <div class="desc">${t.desc}</div>
    <div id="qp"></div>
    <div class="url">${baseUrl}?form=${t.tip}</div>
    <script>
      window.onload = function(){
        new QRCode(document.getElementById('qp'), {
          text:'${baseUrl}?form=${t.tip}',
          width:200, height:200,
          colorDark:'${t.renk}', colorLight:'#ffffff'
        });
        setTimeout(()=>window.print(), 900);
      };
    <\/script>
  </body></html>`);
  win.document.close();
}

function printAllQR(){
  const baseUrl = (_qrBaseUrl || window.location.origin + '/5s/');
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>5S QR Kodları</title>
    <style>
      body{font-family:sans-serif;margin:0;padding:24px;}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;}
      .card{border:1px solid #ddd;border-radius:10px;padding:20px;text-align:center;break-inside:avoid;}
      .icon{font-size:28px;margin-bottom:6px;}
      .adi{font-size:18px;font-weight:700;margin-bottom:4px;}
      .desc{font-size:11px;color:#666;margin-bottom:12px;}
      .url{font-size:9px;color:#999;margin-top:6px;word-break:break-all;}
      @media print{body{padding:0;}.card{border:1px solid #ccc;}}
    </style>
    <script src="/js/qrcode.min.js"><\/script>
  </head><body>
    <h2 style="text-align:center;margin-bottom:20px;">5S Denetim — Form QR Kodları</h2>
    <div class="grid">
      ${QR_TIPLER.map(t=>`
        <div class="card" style="border-top:4px solid ${t.renk};">
          <div class="icon">${t.icon}</div>
          <div class="adi" style="color:${t.renk};">${t.adi}</div>
          <div class="desc">${t.desc}</div>
          <div id="qp-${t.tip}"></div>
          <div class="url">${baseUrl}?form=${t.tip}</div>
        </div>
      `).join('')}
    </div>
    <script>
      window.onload = function(){
        ${QR_TIPLER.map(t=>`
          new QRCode(document.getElementById('qp-${t.tip}'), {
            text:'${baseUrl}?form=${t.tip}',
            width:180, height:180,
            colorDark:'${t.renk}', colorLight:'#ffffff'
          });
        `).join('')}
        setTimeout(()=>window.print(), 1200);
      };
    <\/script>
  </body></html>`);
  win.document.close();
}

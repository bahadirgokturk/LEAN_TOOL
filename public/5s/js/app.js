// ============================================================
// app.js — Sabit veriler, state, API katmanı, navigation, utils
// ============================================================

const API_BASE = '/api/s5'; // LEAN_TOOL monoliti: 5S API'leri /api/s5 altinda

// ── Fotoğraf depolama (Supabase Storage) ─────────────────────
// Fotoğraf, 5S oturumunu doğrulayan sunucu endpoint'i üzerinden Storage'a
// yüklenir. Tarayıcıda Supabase anahtarı tutulmaz ve anonim yükleme kapalıdır.
async function uploadPhotoToStorage(dataUrl){
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append('photo', blob, 'audit-photo.jpg');
  const response = await fetch('/api/s5/photos', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if(response.status===401){ doLogout(); throw new Error('Oturum süresi doldu.'); }
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Fotoğraf yüklenemedi.');
  return data.url;
}

// ── API yardımcısı — otomatik 401 yönlendirme ────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 401) {
    doLogout();
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API hatası');
  }
  if (res.status === 204) return null;
  return res.json();
}

// HTML attribute içine güvenli metin. Notlar sunucuda `<`/`>` temizlenerek
// saklanır; tırnak işaretleri hâlâ attribute'ü bozabildiği için burada kaçırılır.
function escAttr(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Pillar ağırlıkları ──────────────────────────────────────
const PW = { S1:20, S2:20, S3:20, S4:20, S5:20 };

// ── Pillar soruları ─────────────────────────────────────────
// Yerleşik varsayılan 5S formu. Admin bir şablonu "aktif" yapmadıkça denetimler
// bu soruları kullanır. DEĞİŞTİRMEYİN — aktif set `PILLARS` üzerinden yönetilir.
const DEFAULT_PILLARS = [
  {
    id:'S1', name:'Seiri (Ayıklama)', desc:'Gereksiz malzemeleri tespit et ve uzaklaştır', color:'#c0392b',
    questions:[
      { text:'Makine üstü, çekmeceler ve prosesteki kullanım alanlarında kaç adet prosesle ilgisi olmayan malzeme, ekipman, kişisel eşya vb. bulunmaktadır?', type:'count', countLabel:'adet', w:5, photo:true },
      { text:'Sahada kaç adet arızalı, kırık veya kalibrasyonu kaçmış, kullanılmaması gereken ekipman/aparat bulunmaktadır?', type:'count', countLabel:'adet', w:5, photo:true },
      { text:'Panolarda veya makine üzerlerinde kaç tane güncelliğini yitirmiş talimat, duyuru, form ya da teknik çizim bulunmaktadır?', type:'count', countLabel:'adet', w:3, photo:true },
      { text:'Aynı iş için kullanılan gereksiz, fazla sayıda ekipman bulunuyor mu? (Pense, tornavida, alyan vb. el aletleri)', type:'yn3', mcOptions:['Hiç yok','1-2 adet fazla','3+ adet fazla / ciddi sorun'], w:3, photo:true }
    ]
  },
  {
    id:'S2', name:'Seiton (Düzenleme)', desc:'Her şeyin yerini belirle ve görünür kıl', color:'#2980b9',
    questions:[
      { text:'Makina üzeri ve çevresinde alan tanımı yapılmamış kaç adet malzeme bulunmaktadır? (El aletleri, aparatlar, sarf malzemeler vb.)', type:'count', countLabel:'adet', w:5, photo:true },
      { text:'Tanımlandığı alanda bulunmayan (kullanımda olanlar hariç) kaç adet aparat, ekipman, ölçü aleti, malzeme, evrak vb. bulunmaktadır?', type:'count', countLabel:'adet', w:5, photo:true },
      { text:'Belirlenmiş alan tanımına uymayan kaç adet araç (silindir arabası, aparat arabası vb.) bulunmaktadır?', type:'count', countLabel:'adet', w:3, photo:true },
      { text:'Acil durum butonu, yangın tüpleri, ilk yardım dolabı veya göz duşu vb. erişilebilir midir?', type:'yn3', mcOptions:['Tümü erişilebilir','Kısmen erişilebilir','Erişilemiyor / Yok'], w:1, photo:true },
      { text:'Saklama ve stok alanlarında malzeme/ekipmanlar için min/maks seviyeleri belirlenmiş mi?', type:'yn3', mcOptions:['Belirlenmiş ve uyuluyor','Belirlenmiş ama uyulmuyor','Belirlenmemiş'], w:3, photo:false }
    ]
  },
  {
    id:'S3', name:'Seiso (Temizlik)', desc:'Çalışma alanını temiz ve sağlıklı tut', color:'#27ae60',
    questions:[
      { text:'Makine üstü, çekmece veya raf gibi kullanım alanlarında yüzeyler düzenli olarak temizleniyor mu?', type:'count', countLabel:'uygunsuz alan', w:5, photo:true },
      { text:'Üretim alanı ve çevresi temiz mi?', type:'yn3', mcOptions:['Tamamen temiz','Kısmen temiz (küçük sorunlar)','Kirli / temizlenmemiş'], w:1, photo:true },
      { text:'Kaç tane paslı, boya lekeli, kaynak çapaklı makine parçası, aparat, el aleti vb. bulunmaktadır?', type:'count', countLabel:'adet', w:5, photo:true },
      { text:'Çalışma ortamındaki fiziksel koşullar (aydınlatma, havalandırma, gürültü seviyesi) sağlıklı ve ergonomik bir çalışma düzeni sağlıyor mu?', type:'yn3', mcOptions:['Tümü uygun','Çoğu uygun / küçük eksik','Yetersiz / uygun değil'], w:3, photo:true },
      { text:'Erişilebilir temizlik istasyonu var mı? Varsa malzemeler yeterli mi?', type:'mc', options:['Var ve tam','Var ama eksik','Yok'], w:1, photo:true }
    ]
  },
  {
    id:'S4', name:'Seiketsu (Standartlaştırma)', desc:'Standartları belgele ve görünür kıl', color:'#8e44ad',
    questions:[
      { text:'Standart Operasyon Formu (SOF) prosesteki operatörlerce biliniyor mu?', type:'mc', options:['Tümü biliyor','Çoğu biliyor','Az kişi biliyor','Kimse bilmiyor'], w:5, photo:false },
      { text:'Etiketleme ve işaretlemeler firma standartlarına uygun mu?', type:'yn3', mcOptions:['Tümü uygun','Kısmen uygun (bazı eksikler)','Uygun değil / hiç yok'], w:1, photo:true },
      { text:'Otonom bakım formları güncel olarak kullanılıyor mu?', type:'yn3', mcOptions:['Güncel ve aktif kullanımda','Var ama güncel değil','Kullanılmıyor / yok'], w:3, photo:false },
      { text:'Saha genelinde "Bir Fikrim Var" ve "Ramakkala" sistemi aktif olarak kullanılıyor mu?', type:'yn3', mcOptions:['Aktif kullanımda','Zaman zaman kullanılıyor','Kullanılmıyor'], w:1, photo:false },
      { text:'Alana dışarıdan bakan biri, standart dışı durumları ve anormallikleri 30 saniye içinde fark edebiliyor mu?', type:'yn3', mcOptions:['Kolayca fark eder','Kısmen fark eder','Fark edemez / standart yok'], w:3, photo:false }
    ]
  },
  {
    id:'S5', name:'Shitsuke (Eğitim-Disiplin)', desc:'Disiplini koru ve sürekli iyileştir', color:'#d35400',
    questions:[
      { text:"Takım üyeleri 5S'in ne olduğunu biliyor mu?", type:'mc', options:['Tümü biliyor','Çoğu biliyor','Az kişi biliyor','Kimse bilmiyor'], w:3, photo:false },
      { text:'Çalışma alanındaki standart düzen biliniyor mu?', type:'mc', options:['Tümü biliyor','Çoğu biliyor','Az kişi biliyor','Kimse bilmiyor'], w:3, photo:false },
      { text:'Vardiya başlangıcında 5S uygunsuzlukları tespit edilerek gerekli aksiyonlar alınıyor mu?', type:'yn3', mcOptions:['Her vardiya yapılıyor','Zaman zaman yapılıyor','Yapılmıyor'], w:5, photo:false },
      { text:'Bir önceki denetimden bu yana belirlenen uygunsuzluklar 5S planına aktarılmış ve aksiyonlar alınmış mı?', type:'yn3', mcOptions:['Tümü aktarılmış ve çözülmüş','Kısmen aktarılmış','Aktarılmamış / aksiyon yok'], w:1, photo:false }
    ]
  }
];

// ── Aktif soru seti ──────────────────────────────────────────
// Denetim ekranı, puanlama ve kaydetme HER ZAMAN `PILLARS` üzerinden çalışır.
// Varsayılan olarak yerleşik forma eşittir; admin bir şablonu "aktif" yaparsa
// applyActiveTemplate() bu diziyi şablonun sorularıyla yeniden kurar.
let PILLARS = clonePillars(DEFAULT_PILLARS);

// Denetimde kullanılan şablonun kimliği. Denetim kaydedilirken saklanır ki
// denetim sonradan düzenlenirken aynı sorularla açılsın.
let ACTIVE_TEMPLATE_ID = null;

// Cevap tipleri — editörde ve dönüştürücüde kullanılan tek kaynak.
const ANSWER_TYPES = [
  { value:'yn3',   label:'Evet / Kısmen / Hayır' },
  { value:'yn',    label:'Evet / Hayır' },
  { value:'count', label:'Sayı (adet)' },
  { value:'mc',    label:'Çoktan seçmeli' },
  { value:'score', label:'Puan (0-4)' },
];
const ANSWER_TYPE_SET = new Set(ANSWER_TYPES.map(t=>t.value));

function clonePillars(src){
  return src.map(p=>({
    id:p.id, name:p.name, desc:p.desc, color:p.color,
    questions:(p.questions||[]).map(q=>({ ...q, mcOptions:q.mcOptions?[...q.mcOptions]:undefined, options:q.options?[...q.options]:undefined })),
  }));
}

// Şablonda bir soru ya düz metin (eski format) ya da tam nesne olabilir.
// Her iki durumu da denetim motorunun beklediği iç yapıya normalize eder.
function templateQuestionToInternal(raw){
  if(typeof raw === 'string') return { text:raw, type:'yn3', w:3, photo:true };
  const q = raw || {};
  const type = ANSWER_TYPE_SET.has(q.type) ? q.type : 'yn3';
  const opts = Array.isArray(q.options) ? q.options.filter(o=>String(o).trim()) : [];
  const out = {
    text: String(q.text||'').trim(),
    type,
    w: [1,3,5].includes(+q.w) ? +q.w : 3,
    photo: q.photo !== false,
  };
  if(type==='mc'){ out.options = opts.length?opts:['Uygun','Kısmen','Uygun değil']; }
  if(type==='count'){ out.countLabel = String(q.countLabel||'adet'); }
  return out;
}

// Bir şablonun `pillarlar` verisini, 5 sabit adımın (S1-S5) meta bilgisini
// koruyarak aktif soru setine dönüştürür. Şablonda tanımı olmayan adım için
// yerleşik varsayılan sorular kullanılır.
function pillarsFromTemplate(pillarlar){
  const byId = {};
  (pillarlar||[]).forEach(p=>{ if(p&&p.id) byId[p.id]=p; });
  return DEFAULT_PILLARS.map(def=>{
    const tpl = byId[def.id];
    const sorular = tpl && Array.isArray(tpl.sorular) ? tpl.sorular : null;
    const questions = sorular
      ? sorular.map(templateQuestionToInternal).filter(q=>q.text)
      : clonePillars([def])[0].questions;
    return { id:def.id, name:def.name, desc:def.desc, color:def.color, questions };
  });
}

function getActiveTemplate(){
  return (S.formSablonlari||[]).find(f=>f.aktif===true) || null;
}

// Aktif şablonu uygular (yoksa yerleşik varsayılana döner). Şablonlar
// yüklendiğinde ve aktiflik değiştiğinde çağrılır.
function applyActiveTemplate(){
  const active = getActiveTemplate();
  ACTIVE_TEMPLATE_ID = active?.id || null;
  PILLARS = active ? pillarsFromTemplate(active.pillarlar) : clonePillars(DEFAULT_PILLARS);
}

/**
 * Belirli bir şablonu uygular. Form seçimi admin'in kontrolündedir:
 * atamada bir şablon seçilmişse denetçi onu görür ve değiştiremez.
 * Şablon bulunamazsa (silinmiş olabilir) aktif şablona, o da yoksa
 * yerleşik forma güvenli şekilde düşer.
 */
function applyTemplateById(templateId){
  const tpl = (!templateId || templateId==='default')
    ? null
    : (S.formSablonlari||[]).find(f=>f.id===templateId);

  if(!tpl){ applyActiveTemplate(); return; }

  ACTIVE_TEMPLATE_ID = tpl.id;
  PILLARS = pillarsFromTemplate(tpl.pillarlar);
}

/**
 * Bir QR form tipine (uretim/operasyon/ofis/kalite) bağlanmış şablonu bulur.
 * Yönetici şablon ekranından bağlar; bağlı şablon yoksa null döner.
 */
function templateForFormTip(tip){
  if(!tip || tip==='diger') return null;
  return (S.formSablonlari||[]).find(f=>f.form_tipi===tip) || null;
}

/**
 * Form tipine tanımlı soru setini uygular. Tipe bağlı şablon yoksa
 * varsayılan (aktif) şablona, o da yoksa yerleşik forma düşer.
 * Uygulanan şablonun kimliğini döndürür.
 */
function applyTemplateForFormTip(tip){
  const tpl = templateForFormTip(tip);
  if(tpl){
    ACTIVE_TEMPLATE_ID = tpl.id;
    PILLARS = pillarsFromTemplate(tpl.pillarlar);
  } else {
    applyActiveTemplate();
  }
  return ACTIVE_TEMPLATE_ID;
}

/** Bir alanın bölümüne göre kullanılması gereken şablonun kimliği. */
function templateIdForArea(area){
  const tpl = templateForFormTip(getAreaFormTip(area));
  return tpl ? tpl.id : (getActiveTemplate()?.id || null);
}

/** Denetim ekranında kullanılan formun adı (denetçiye bilgi olarak gösterilir). */
function getCurrentTemplateName(){
  const tpl = (S.formSablonlari||[]).find(f=>f.id===ACTIVE_TEMPLATE_ID);
  return tpl ? tpl.adi : 'Yerleşik 5S Formu';
}

// ── Form tipleri (QR sistemi) ────────────────────────────────
const FORM_TIP_LABEL = { uretim:'Üretim', operasyon:'Operasyon', ofis:'Ofis', kalite:'Kalite Kontrol' };
const FORM_TIP_RENK  = { uretim:'#c0392b', operasyon:'#16a085', ofis:'#8e44ad', kalite:'#2980b9' };
const FORM_TIP_ICON  = { uretim:'🏭', operasyon:'⚙️', ofis:'🏢', kalite:'🔍' };

// Bir alanın form tipini döndür
function getAreaFormTip(area){
  if(!area) return 'diger';
  const d = area.dept||'';
  if(d==='Kalite Kontrol' || area.alt_dept==='Kalite') return 'kalite';
  if(['Üretim','Çelik Üretim','Flexible','Tobacco'].includes(d)) return 'uretim';
  if(d==='Operasyon') return 'operasyon';
  if(d==='Ofis')      return 'ofis';
  return 'diger';
}

// Fabrika yapısı
const FABRIKA_YAPI = {
  'İzmir': { renk:'#c0392b', deptler: { 'Üretim':{ renk:'#2980b9', altDeptler:{'Tobacco':['1. Grup','2. Grup','3. Grup','Prova'],'Flexible':['Dekrom','CFM','Bakır Kaplama/Finish','Lazer/Etching','Gravür','Krom Kaplama/Finish'],'Destek':['Polish/Finish','Otomatik Hat','Prova']} },'Operasyon':{ renk:'#16a085', altDeptler:{'Bakım':['Mekanik Bakım','Elektrik Bakım'],'Planlama':['Giriş Depo','Sevkiyat','Hammadde Depo'],'Kalite':['Kalite Kontrol','Kalite Ofisi']} },'Ofis':{ renk:'#8e44ad', altDeptler:{'Ofis':['OPEX','Üretim Ofisi','Planlama','İnsan Kaynakları','Domestic Satış','Tobacco Satış','Export Satış','Muhasebe']} } } },
  'Esbaş': { renk:'#2980b9', deptler: { 'Üretim':{ renk:'#27ae60', altDeptler:{'Çelik Üretim':['Kaba Balans','Taşlama','Kaynak Alanı','CNC','Kalite Kontrol']} } } },
  'İspak': { renk:'#8e44ad', deptler: { 'Üretim':{ renk:'#d35400', altDeptler:{'Genel Üretim':['CFM-Dekrom','Otomatik Hat','Prova']} } } },
  'Karaman': { renk:'#27ae60', deptler: { 'Üretim':{ renk:'#2980b9', altDeptler:{'Flex/Tob':['Dekrom','CFM','Bakır Kaplama','Polish/Finish','Gravür','Krom Kaplama/Finish','Prova'],'Çelik Üretim':['Kaba Balans','Taşlama','Kaynak Alanı','CNC','Freze','Kalite Kontrol']} } } },
};

// ── Düzenleme modu state (burada tanımlanır, audit.js'de kullanılır) ─────
let _editAuditId = null;

// ── Uygulama state'i ─────────────────────────────────────────
let S = {
  audits: [], areas: [], users: [], actions: [],
  auditors: [], atamalar: [], hedefler: {},
  answers: {}, photos: {}, notes: {}, typeOverrides: {},
  fabrikaFilter: 'all', adminFilter: 'all', timeFilter: 'year',
};

let CURRENT_USER = null;

// ── Scoring ──────────────────────────────────────────────────
function countToScore(n){ return n===0?4:n<=2?3:n<=4?2:n<=6?1:0; }
function ynToScore(v){ return v==='evet'?4:v==='hayır'?0:null; }
function yn3ToScore(v){ return v==='evet'?4:v==='kısmen'?2:v==='hayır'?0:null; }
function mcToScore(idx, optCount){ return idx===null||idx===undefined?null: Math.round(4*(1-idx/(optCount-1))); }

function getAnswerScore(q, ans, pi, qi){
  if(ans===null||ans===undefined) return null;
  const eff = (pi!==undefined&&qi!==undefined&&S.typeOverrides&&S.typeOverrides[pi]&&S.typeOverrides[pi][qi]) ? S.typeOverrides[pi][qi] : q.type;
  if(eff==='yn') return ynToScore(ans);
  if(eff==='yn3') return yn3ToScore(ans);
  if(eff==='count') return countToScore(typeof ans==='number'?ans:parseInt(ans)||0);
  if(eff==='score') return typeof ans==='number'?ans:null;
  if(eff==='mc'){ const optLen=(q.mcOptions||q.options||[]).length||3; return mcToScore(ans, optLen); }
  return null;
}

function calcPillar(pi, answers){
  const p = PILLARS[pi]; let wSum=0, wTot=0;
  p.questions.forEach((q,qi)=>{
    const s = getAnswerScore(q, (answers||[])[qi], pi, qi);
    if(s!==null){ wSum+=s*q.w; wTot+=4*q.w; }
  });
  if(wTot===0) return { pct:0, contribution:0 };
  const pct = (wSum/wTot)*100;
  return { pct: Math.round(pct*10)/10, contribution: Math.round((pct/100)*PW[p.id]*10)/10 };
}

function calcTotal(allAnswers){
  return Math.round(PILLARS.reduce((t,p,pi)=>t+calcPillar(pi,allAnswers[pi]||[]).contribution,0));
}

// ── Yardımcı fonksiyonlar ────────────────────────────────────
function scoreColor(s){ return s>=85?'var(--green)':s>=70?'var(--blue)':s>=50?'var(--amber)':'var(--red)'; }
function scoreLabel(s){ return s>=85?'Mükemmel':s>=70?'İyi':s>=50?'Orta':'Geliştirilmeli'; }
function scoreBadge(s){ return s>=85?'badge-green':s>=70?'badge-blue':s>=50?'badge-amber':'badge-red'; }

// ── S-Seviye Puanlama Sistemi (0S – 5S) ─────────────────────
// Her pillar 0-20 arası normalize edilir. ≥18 → tam geçti (1.0S)
// <18 → takıldı, kesirli S ekle ve dur.
function calculateSLevel(audit){
  const pjsRaw = audit.pillars_json || {};
  // Hem dizi hem nesne formatını destekle
  const pjs = Array.isArray(pjsRaw)
    ? PILLARS.reduce((m,p,i)=>{ m[p.id]=pjsRaw[i]||{}; return m; }, {})
    : pjsRaw;
  let sLevel = 0;
  for(let i=0; i<PILLARS.length; i++){
    const pct = pjs[PILLARS[i].id]?.pct ?? 0;
    const raw = (pct / 100) * 20; // 0-20 normalize
    if(raw >= 18){
      sLevel += 1.0; // Tam geçti
    } else {
      sLevel += raw / 20; // = pct/100, kesirli ekle
      break; // Takıldı — dur
    }
  }
  return Math.round(sLevel * 100) / 100;
}

function formatSLevel(sl){ return (typeof sl==='number'?sl:0).toFixed(2)+'S'; }
function sLevelColor(sl){ return sl>=4?'var(--green)':sl>=3?'var(--blue)':sl>=2?'var(--amber)':'var(--red)'; }
function sLevelBadge(sl){ return sl>=4?'badge-green':sl>=3?'badge-blue':sl>=2?'badge-amber':'badge-red'; }
function sLevelLabel(sl){ return sl>=4?'Mükemmel':sl>=3?'İyi':sl>=2?'Orta':'Geliştirilmeli'; }
// Pillar için geçti/takıldı kontrolü (pct>=90 → raw>=18 → geçti)
function pillarPassed(pct){ return pct >= 90; }

function showToast(m){
  const t=document.getElementById('toast');
  t.textContent=m; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

function toggleSidebar(){
  const sb=document.querySelector('.sidebar'), ov=document.getElementById('sb-overlay');
  sb.classList.toggle('mob-open'); ov.classList.toggle('mob-open');
}
function closeSidebar(){
  document.querySelector('.sidebar').classList.remove('mob-open');
  document.getElementById('sb-overlay').classList.remove('mob-open');
}

// ── Navigasyon ────────────────────────────────────────────────
/**
 * Tarih gosterimi.
 *
 * Sunucu `date` alanini ISO zaman damgasi olarak donebiliyor
 * ("2026-08-18T00:00:00.000Z"); ekranda ham haliyle gorunuyordu.
 */
function formatDate(value){
  if(!value) return '—';
  const metin = String(value);
  const gun = metin.slice(0, 10);              // YYYY-MM-DD
  const parcalar = gun.split('-');
  if(parcalar.length !== 3) return metin;
  const [yil, ay, tarih] = parcalar;
  return `${tarih}.${ay}.${yil}`;
}

/** input[type=date] yalnizca YYYY-MM-DD kabul eder; ISO damga alani bos birakir. */
function toDateInputValue(value){
  return value ? String(value).slice(0, 10) : '';
}

/** Denetci ekraninda basliklar gorev odakli. */
const DENETCI_TITLES = { 'dashboard':'Görevlerim', 'history':'Denetimlerim' };

const TITLES = {
  'dashboard':'Dashboard','new-audit':'Yeni Denetim','history':'Denetim Geçmişi',
  'areas':'Bölge Yönetimi','actions':'Aksiyonlar','reports':'Raporlar',
  'leaderboard':'🏆 Takım Sıralaması','qr':'⬛ QR Kodlar','hedefler':'🎯 Hedef Skorlar',
  'takvim':'📅 Denetim Takvimi','denetciler':'👤 Denetçi Performansı',
  'karsilastirma':'📊 Bölge Karşılaştırma','kullanicilar':'⚙ Kullanıcı Yönetimi',
  'formlar':'📝 Form Şablonları',
};

// ── Aktif sayfa yenileme (🔄 butonu) ─────────────────────────
function refreshCurrentPage(){
  const active = document.querySelector('.page.active');
  if(!active) return;
  const pageId = active.id?.replace('page-','');
  const renderMap = {
    'dashboard': renderDashboard, 'history': renderHistory,
    'actions': renderActions, 'reports': renderReports,
    'areas': renderAreas, 'leaderboard': renderLeaderboard,
    'denetciler': renderDenetciler, 'karsilastirma': renderKarsilastirma,
  };
  const fn = renderMap[pageId];
  if(fn) _refreshAndRender(fn).then(()=>showToast('🔄 Veriler güncellendi'));
  else showToast('🔄 Güncellendi');
}

// ── Veri yenileme + yeniden render ───────────────────────────
async function _refreshAndRender(renderFn){
  renderFn(); // mevcut veriyle hemen göster
  try {
    const [audits, actions] = await Promise.all([
      apiFetch('/audits?limit=1000'),
      apiFetch('/actions?limit=500'),
    ]);
    if(audits)  S.audits  = audits;
    if(actions) S.actions = actions;
    updateBadges();
    renderFn(); // taze veriyle yeniden render
  } catch(e){ console.warn('Veri yenileme başarısız:', e); }
}

/**
 * Rol basina acilabilir sayfalar.
 *
 * Menu zaten role gore kuruluyor; bu, menu disindan gelen yonlendirmeler icin
 * son savunma (QR yonlendirmesi, eski yer imi, elde kalan buton). Denetci
 * yalnizca kendisine atanan denetimleri ve kendi yaptigi denetimleri gorur.
 * Listede olmayan rol (admin) her sayfaya girebilir.
 */
const ROLE_PAGES = {
  denetci:    ['dashboard','new-audit','history'],
  takimlider: ['dashboard','history','actions','reports'],
  departman:  ['dashboard','history','actions','reports'],
};

function isPageAllowed(page){
  const allowed = ROLE_PAGES[CURRENT_USER?.role];
  return !allowed || allowed.includes(page);
}

function navigate(p){
  if(!isPageAllowed(p)) p = 'dashboard';
  document.querySelectorAll('.page').forEach(x=>{ x.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  const target = document.getElementById('page-'+p);
  if(target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(x=>{ if(x.getAttribute('onclick')?.includes("'"+p+"'")) x.classList.add('active'); });
  const titleEl = document.getElementById('topbar-title');
  if(titleEl){
    const denetciBaslik = CURRENT_USER?.role==='denetci' ? DENETCI_TITLES[p] : null;
    titleEl.textContent = denetciBaslik || TITLES[p] || '';
  }
  closeSidebar();
  if(p==='dashboard') _refreshAndRender(renderDashboard);
  if(p==='history')   _refreshAndRender(renderHistory);
  if(p==='areas')     renderAreas();
  if(p==='actions')   { _refreshAndRender(renderActions); }
  if(p==='reports')   { _refreshAndRender(renderReports); }
  if(p==='new-audit') { _editAuditId=null; initForm(); }
  if(p==='leaderboard') renderLeaderboard();
  if(p==='qr')        renderQRPage();
  if(p==='hedefler')  renderHedefler();
  if(p==='takvim')    renderTakvim();
  if(p==='denetciler') renderDenetciler();
  if(p==='karsilastirma') renderKarsilastirma();
  if(p==='kullanicilar')  renderKullanicilar();
  if(p==='formlar')   renderFormSablonlari();
}

// ── Badge güncelleme ──────────────────────────────────────────
function updateBadges(){
  const open = S.actions.filter(a=>a.status==='Açık').length;
  ['action-badge','action-badge-d'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=open; });
  ['hist-badge','hist-badge-d'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=S.audits.length; });
  const bb=document.getElementById('bnav-act-badge');
  if(bb){ bb.textContent=open; bb.style.display=open>0?'block':'none'; }
}

// ── Dashboard filtre yardımcıları ─────────────────────────────
function setFabrikaFilter(f){
  S.fabrikaFilter=f;
  S.adminFilter='all';  // fabrika değişince dept filtreyi sıfırla
  document.querySelectorAll('[id^="fabrika-btn-"]').forEach(b=>b.className='btn btn-outline btn-sm');
  const active=document.getElementById('fabrika-btn-'+f);
  if(active) active.className='btn btn-primary btn-sm';
  renderDeptFilterRow(f);
  renderAdminDashboard();
}

function setAdminFilter(dept, bolum=null){
  S.adminFilter=dept; S.adminBolum=bolum||null;
  renderAdminDashboard();
}

function setTimeFilter(period){
  S.timeFilter=period;
  ['year','lastmonth','month'].forEach(p=>{ const b=document.getElementById('time-btn-'+p); if(b) b.className='btn btn-outline btn-sm'; });
  const ab=document.getElementById('time-btn-'+period);
  if(ab) ab.className='btn btn-primary btn-sm';
  renderAdminDashboard();
}

function getTimeRange(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  if(S.timeFilter==='month')     return { from:new Date(y,m,1), to:new Date(y,m+1,0) };
  if(S.timeFilter==='lastmonth') return { from:new Date(y,m-1,1), to:new Date(y,m,0) };
  return { from:new Date(y,0,1), to:new Date(y,11,31) };
}

function getFilteredAudits(){
  const { from, to } = getTimeRange();
  return S.audits.filter(a=>{
    const d=new Date(a.date);
    if(d<from||d>to) return false;
    if(S.fabrikaFilter!=='all'){
      const area=S.areas.find(ar=>ar.id===a.area_id||ar.name===a.area_name);
      if(!area||area.fabrika!==S.fabrikaFilter) return false;
    }
    if(S.adminFilter!=='all'){
      const area=S.areas.find(ar=>ar.id===a.area_id||ar.name===a.area_name);
      if(!area||area.dept!==S.adminFilter) return false;
    }
    return true;
  });
}

function renderDeptFilterRow(fabrika){
  const row=document.getElementById('dept-filter-row'); if(!row) return;
  row.innerHTML='<span style="font-size:11px;font-weight:600;color:var(--text2);margin-right:2px;">DEPARTMAN:</span>';
  const cur=S.adminFilter||'all';
  const allBtn=document.createElement('button');
  allBtn.className='btn btn-sm '+(cur==='all'?'btn-primary':'btn-outline');
  allBtn.id='filter-btn-all';
  allBtn.textContent='Tümü';
  allBtn.onclick=()=>setAdminFilter('all');
  row.appendChild(allBtn);
  const deptler = fabrika==='all' ? [...new Set(S.areas.map(a=>a.dept).filter(Boolean))] : Object.keys(FABRIKA_YAPI[fabrika]?.deptler||{});
  deptler.forEach(d=>{
    const b=document.createElement('button');
    b.className='btn btn-sm '+(cur===d?'btn-primary':'btn-outline');
    b.textContent=d;
    b.onclick=()=>setAdminFilter(d);
    row.appendChild(b);
  });
}

// ── Modal backdrop kapatma ────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.modal-ov').forEach(o=>{
    o.addEventListener('click', e=>{ if(e.target===o) o.classList.remove('open'); });
  });
});

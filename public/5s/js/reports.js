// ============================================================
// reports.js — Raporlar, grafikler, CSV export
// ============================================================

let _trendChart  = null;
let _pillarChart = null;

function renderReports(){
  // Backend zaten fabrika+dept filtreli veri gönderiyor — S.audits ve S.areas doğru
  let audits = [...S.audits];

  _renderReportTopStats(audits);
  _renderTrendChart(audits);
  _renderPillarChart(audits);
}

function _renderReportTopStats(audits){
  if(!audits.length){
    _set('r-best','—'); _set('r-worst','—'); _set('r-trend','—'); _set('r-comp','0%');
    document.getElementById('r-best-s')&&(document.getElementById('r-best-s').textContent='');
    document.getElementById('r-worst-s')&&(document.getElementById('r-worst-s').textContent='');
    return;
  }

  // En iyi / en kötü alan (son denetim skoru)
  const areaScores = {};
  audits.forEach(a=>{
    if(!a.area_id) return;
    if(!areaScores[a.area_id]||new Date(a.date)>new Date(areaScores[a.area_id].date)){
      areaScores[a.area_id] = a;
    }
  });
  const sorted = Object.values(areaScores).sort((a,b)=>Number(b.total_score)-Number(a.total_score));
  const best   = sorted[0];
  const worst  = sorted[sorted.length-1];
  const bestArea  = best  ? S.areas.find(a=>a.id===best.area_id) : null;
  const worstArea = worst ? S.areas.find(a=>a.id===worst.area_id): null;

  _set('r-best',  bestArea?.name  || '—');
  _set('r-worst', worstArea?.name || '—');
  const bsEl=document.getElementById('r-best-s');  if(bsEl)  bsEl.textContent  = best  ? best.total_score+' puan'  :'';
  const wsEl=document.getElementById('r-worst-s'); if(wsEl)  wsEl.textContent  = worst ? worst.total_score+' puan':'';

  // Trend (son iki ayın karşılaştırması)
  const now  = new Date();
  const m1s  = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
  const m0s  = new Date(now.getFullYear(), now.getMonth(),   1).toISOString().slice(0,7);
  const m1   = audits.filter(a=>a.date?.startsWith(m1s));
  const m0   = audits.filter(a=>a.date?.startsWith(m0s));
  const avg  = arr => arr.length ? arr.reduce((s,a)=>s+Number(a.total_score),0)/arr.length : null;
  const d    = avg(m0) !== null && avg(m1) !== null ? Math.round(avg(m0)-avg(m1)) : null;
  _set('r-trend', d!==null ? (d>=0?'+':'')+d+' puan' : '—');

  // Aksiyon tamamlanma
  const total = S.actions.length;
  const done  = S.actions.filter(a=>a.status==='Tamamlandı').length;
  _set('r-comp', total ? Math.round(done/total*100)+'%' : '0%');
}

function _set(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}

function _renderTrendChart(audits){
  const ctx = document.getElementById('trendChart');
  if(!ctx || !window.Chart) return;

  const monthly = {};
  audits.forEach(a=>{
    const key = a.date?.slice(0,7);
    if(!key) return;
    if(!monthly[key]) monthly[key]={sum:0,cnt:0};
    monthly[key].sum += Number(a.total_score||0);
    monthly[key].cnt++;
  });
  const labels = Object.keys(monthly).sort().slice(-12);
  const data   = labels.map(k=>Math.round(monthly[k].sum/monthly[k].cnt));

  if(_trendChart) _trendChart.destroy();
  _trendChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: labels.map(l=>{ const [y,m]=l.split('-'); return `${m}/${y}`; }),
      datasets:[{
        label:'Aylık Ort.',
        data,
        borderColor:'#3b82f6',
        backgroundColor:'rgba(59,130,246,0.08)',
        tension:0.4, fill:true, pointRadius:3, pointBackgroundColor:'#3b82f6'
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{y:{min:0,max:100,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},x:{ticks:{font:{size:10}}}},
      plugins:{legend:{display:false}}
    }
  });
}

function _renderPillarChart(audits){
  const ctx = document.getElementById('pillarChart');
  if(!ctx || !window.Chart) return;

  const pillarAvgs = PILLARS.map((p,pi)=>{
    const vals = audits.map(a=>{
      const pils = Array.isArray(a.pillars_json) ? a.pillars_json : (a.pillars_json ? Object.values(a.pillars_json) : []);
      return pils[pi]?.pct ?? pils[pi]?.score ?? null;
    }).filter(v=>v!=null);
    return vals.length ? Math.round(vals.reduce((s,v)=>s+Number(v),0)/vals.length) : 0;
  });

  if(_pillarChart) _pillarChart.destroy();
  _pillarChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: PILLARS.map(p=>p.name),
      datasets:[{
        label:'Ort. Puan',
        data: pillarAvgs,
        backgroundColor: pillarAvgs.map(v=>v>=75?'rgba(34,197,94,0.75)':v>=50?'rgba(251,191,36,0.75)':'rgba(239,68,68,0.75)'),
        borderRadius: 5
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      scales:{y:{min:0,max:100,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},x:{ticks:{font:{size:11}}}},
      plugins:{legend:{display:false}}
    }
  });
}

function exportCSV(){
  // Backend zaten fabrika+dept filtreli veri gönderiyor
  let audits = [...S.audits];

  const rows = [
    ['Tarih','Alan','Fabrika','Denetçi','Vardiya','Toplam Puan',...PILLARS.map(p=>p.name)]
  ];

  audits.forEach(a=>{
    const area = S.areas.find(ar=>ar.id===a.area_id);
    const pils = a.pillars_json||a.pillars||[];
    rows.push([
      a.date?.slice(0,10)||'',
      area?.name||a.area_name||a.area_id||'',
      area?.fabrika||'',
      a.auditor_name||'',
      a.shift||'',
      a.total_score||0,
      ...PILLARS.map((_,pi)=>pils[pi]?.pct??pils[pi]?.score??'')
    ]);
  });

  const csv  = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `5S-Rapor-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

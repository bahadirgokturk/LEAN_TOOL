import { buildAnalytics, pillarIds } from '../lib/s5/analytics';

declare function getFilteredAudits(): S5Audit[];
declare function calculateSLevel(audit: S5Audit): number;
declare function formatSLevel(level: number): string;
declare const PILLARS: Array<{ id: string; name: string }>;
type Model = ReturnType<typeof buildAnalytics<S5Audit>>;
type ChartHandle = { destroy(): void };
declare global {
  interface Window {
    Chart?: new (canvas: HTMLCanvasElement, config: Record<string, unknown>) => ChartHandle;
    renderReports: () => void;
    exportCSV: () => void;
    s5Analytics: {
      renderDashboardCharts: (audits: S5Audit[]) => void;
      renderComparison: () => void;
    };
  }
}
const charts = new Map<string, ChartHandle>();
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const levelText = (level: number | null) => level === null ? '—' : formatSLevel(level);
const pointsText = (value: number | null) => value === null ? '—' : String(Math.round(value * 10) / 10);
function getModel(audits = getFilteredAudits()): Model {
  const areas = S.areas.filter(area => (!S.fabrikaFilter || S.fabrikaFilter === 'all' || area.fabrika === S.fabrikaFilter) && (!S.adminFilter || S.adminFilter === 'all' || area.dept === S.adminFilter));
  return buildAnalytics(audits, areas, calculateSLevel);
}
function setText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
function renderMetrics(model: Model, report: boolean) {
  // Preserve Dashboard's existing best-area criterion (average total points).
  const best = model.areas.filter(area => area.score !== null).sort((left, right) => right.score! - left.score!)[0];
  const planned = S.atamalar || [];
  const completion = planned.length ? Math.round(planned.filter(plan => plan.status === 'Tamamlandı').length / planned.length * 100) : 0;
  const open = S.actions.filter(action => action.status === 'Açık').length;
  setText(report ? 'r-level' : 'm-total', model.count ? levelText(model.level) : '—');
  setText(report ? 'r-completion' : 'm-avg', String(completion));
  setText(report ? 'r-best' : 'm-best', best?.name || '—');
  setText(report ? 'r-best-s' : 'm-best-score', best ? `${Math.round(best.score!)} puan` : '');
  setText(report ? 'r-actions' : 'm-actions', String(open));
  setText(report ? 'r-count' : 'm-total-sub', `${model.count} denetim — seçili dönem`);
}
function table(headers: string[], rows: string[][]): string {
  return `<div class="tbl-wrap"><table><thead><tr>${headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">Seçili dönemde veri yok</td></tr>`}</tbody></table></div>`;
}
function areaTable(areas: Model['areas']): string {
  return table(['Bölge', 'Toplam (S)', ...pillarIds], areas.map(area => [area.name, levelText(area.level), ...area.pillars.map(pointsText)]));
}
function draw(id: string, type: 'bar' | 'radar', labels: string[], values: Array<number | null>) {
  charts.get(id)?.destroy();
  charts.delete(id);
  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement) || !window.Chart) return;
  const isRadar = type === 'radar';
  charts.set(id, new window.Chart(canvas, {
    type, data: { labels, datasets: [{ label: isRadar ? 'Pillar puanı' : '5S seviyesi', data: values, backgroundColor: isRadar ? 'rgba(13,34,64,.25)' : values.map(value => value === null ? 'transparent' : value >= 4 ? 'rgba(46,125,79,.7)' : value >= 3 ? 'rgba(13,34,64,.7)' : value >= 2 ? 'rgba(212,130,10,.7)' : 'rgba(230,51,18,.7)'), borderColor: '#0d2240', borderWidth: isRadar ? 2 : 0, pointBackgroundColor: '#E63312' }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, datalabels: { display: false } },
      scales: isRadar ? { r: { min: 0, max: 100, ticks: { stepSize: 25 } } } : {
        y: { min: 0, max: 5, ticks: { callback: (value: number) => `${value}S` } },
        x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: labels.length > 8 ? 45 : 0 } },
      },
    },
  }));
}
function overallLabels(areas: Model['areas']): string[] {
  return areas.map(area => `${area.name} · ${area.alt_dept || area.dept || 'Genel'}${area.fabrika ? ` · ${area.fabrika}` : ''}`);
}
function renderDashboardCharts(audits: S5Audit[]) {
  const model = getModel(audits);
  renderMetrics(model, false);
  draw('radarChart', 'radar', PILLARS.map(pillar => pillar.id), model.pillars);
  draw('bolumBarChart', 'bar', overallLabels(model.areas), model.areas.map(area => area.level));
}
function renderReports() {
  const container = document.getElementById('report-charts');
  if (!container) return;
  for (const [id, chart] of charts) if (id.startsWith('report-')) { chart.destroy(); charts.delete(id); }
  const model = getModel();
  renderMetrics(model, true);
  const periods: Record<string, string> = { year: 'Bu yıl', lastmonth: 'Geçen ay', month: 'Bu ay' };
  setText('report-scope', `Dashboard ile aynı filtreler: ${S.fabrikaFilter === 'all' ? 'Tüm fabrikalar' : S.fabrikaFilter || 'Tüm fabrikalar'} / ${S.adminFilter === 'all' ? 'Tüm departmanlar' : S.adminFilter || 'Tüm departmanlar'} / ${periods[String(S.timeFilter)] || 'Bu yıl'}`);
  const radarTable = table(['Pillar', 'Ortalama puan'], PILLARS.map((pillar, index) => [pillar.name, pointsText(model.pillars[index])]));
  container.innerHTML = `<section class="card report-chart-row"><div><h3>5S Radar Analizi</h3><div class="report-canvas"><canvas id="report-radar"></canvas></div></div>${radarTable}</section>
    <section class="card"><h3>Tüm Bölgeler — 5S Seviyesi</h3><div class="report-canvas"><canvas id="report-overall"></canvas></div></section>
    ${model.groups.map((group, index) => `<section class="card report-chart-row"><div><h3>${escapeHtml(group.name)}</h3><div class="report-canvas"><canvas id="report-group-${index}"></canvas></div></div>${areaTable(group.areas)}</section>`).join('')}`;
  draw('report-radar', 'radar', PILLARS.map(pillar => pillar.id), model.pillars);
  draw('report-overall', 'bar', overallLabels(model.areas), model.areas.map(area => area.level));
  model.groups.forEach((group, index) => draw(`report-group-${index}`, 'bar', group.areas.map(area => area.name), group.areas.map(area => area.level)));
}
function renderComparison() {
  const element = document.getElementById('karsilastirma-table');
  // Comparison retains its historical all-time scope; only the presentation changes.
  if (element) element.innerHTML = areaTable(buildAnalytics(S.audits, S.areas, calculateSLevel).areas.filter(area => area.count));
}
function exportCSV() {
  const rows: unknown[][] = [['Tarih', 'Alan', 'Fabrika', 'Denetçi', 'Vardiya', 'Toplam Puan', ...PILLARS.map(pillar => pillar.name)]];
  for (const audit of S.audits) {
    const area = S.areas.find(candidate => candidate.id === audit.area_id);
    const pillars = buildAnalytics([audit], [], calculateSLevel).pillars;
    rows.push([audit.date?.slice(0, 10) || '', area?.name || audit.area_name || audit.area_id || '', area?.fabrika || '', audit.auditor_name || '', audit.shift || '', audit.total_score ?? 0, ...pillars.map(value => value ?? '')]);
  }
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `5S-Rapor-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
window.renderReports = renderReports;
window.exportCSV = exportCSV;
window.s5Analytics = { renderDashboardCharts, renderComparison };

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function createFixture() {
  class Canvas { textContent = ''; innerHTML = ''; }
  const elements = new Map<string, Canvas>();
  const configs: Array<{ type: string; data: { labels: string[]; datasets: Array<{ data: number[] }> } }> = [];
  let destroyed = 0;
  const areas = Array.from({ length: 17 }, (_, index) => ({ id: String(index), name: 'Prova', fabrika: 'İzmir', alt_dept: ['Flexible', 'Tobacco', 'Operasyon', 'Genel'][index % 4] }));
  const audits = areas.map(area => ({ id: area.id, area_id: area.id, pillars_json: { S1: { pct: 0 } } }));
  const store = { areas, audits, actions: [], atamalar: [], timeFilter: 'year', fabrikaFilter: 'all', adminFilter: 'all' };
  const window = { Chart: class { constructor(_element: Canvas, config: typeof configs[number]) { configs.push(config); } destroy() { destroyed++; } } };
  const context = vm.createContext({ window, S: store, HTMLCanvasElement: Canvas,
    document: { getElementById: (id: string) => { if (!elements.has(id)) elements.set(id, new Canvas()); return elements.get(id); } },
    getFilteredAudits: () => audits.slice(0, 16), calculateSLevel: () => 1.25,
    formatSLevel: (level: number) => level.toFixed(2) + 'S',
    PILLARS: ['S1','S2','S3','S4','S5'].map(id => ({ id, name: id })),
  });
  vm.runInContext(readFileSync(resolve('public/5s/js/reports.js'), 'utf8'), context);
  return { context, store, elements, configs, destroyed: () => destroyed };
}
describe('generated reports integration', () => {
  it('renders every area and four dynamic department rows from the Dashboard filter', () => {
    const fixture = createFixture();
    vm.runInContext('window.renderReports()', fixture.context);
    expect(fixture.configs).toHaveLength(6);
    expect(fixture.configs[1].data.labels).toHaveLength(17);
    expect(fixture.elements.get('r-count')?.textContent).toContain('16 denetim');
    expect(fixture.elements.get('report-charts')?.innerHTML).toContain('İzmir · Tobacco');
  });
  it('keeps Dashboard/report metrics identical, destroys old charts, and leaves source data intact', () => {
    const fixture = createFixture();
    const before = JSON.stringify(fixture.store);
    vm.runInContext('window.s5Analytics.renderDashboardCharts(getFilteredAudits()); window.renderReports(); window.renderReports();', fixture.context);
    expect(fixture.elements.get('m-total')?.textContent).toBe(fixture.elements.get('r-level')?.textContent);
    expect(fixture.destroyed()).toBe(6);
    expect(JSON.stringify(fixture.store)).toBe(before);
  });
  it('shows S levels and zero pillar scores in comparison, not total points', () => {
    const fixture = createFixture();
    vm.runInContext('window.s5Analytics.renderComparison()', fixture.context);
    const html = fixture.elements.get('karsilastirma-table')?.innerHTML;
    expect(html).toContain('Toplam (S)');
    expect(html).toContain('1.25S');
    expect(html).toContain('<td>0</td>');
  });
  it('keeps the exact requested admin menu and a single QR container in form templates', () => {
    const html = readFileSync(resolve('public/5s/index.html'), 'utf8');
    const menu = html.split('<!-- Admin menüsü -->')[1].split('<!-- Denetçi menüsü -->')[0];
    expect(Array.from(menu.matchAll(/navigate\('([^']+)'\)/g), match => match[1])).toEqual(['dashboard','hedefler','leaderboard','takvim','new-audit','history','areas','actions','karsilastirma','reports','formlar','kullanicilar']);
    expect(html.match(/id="qr-grid"/g)).toHaveLength(1);
    expect(html.split('id="page-formlar"')[1]).toContain('id="qr-grid"');
  });
});

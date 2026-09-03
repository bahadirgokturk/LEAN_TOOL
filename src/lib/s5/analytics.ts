export interface AnalyticsAudit {
  id: string;
  area_id?: string | null;
  area_name?: string;
  pillars_json?: unknown;
  total_score?: number;
}
export interface AnalyticsArea {
  id: string;
  name: string;
  fabrika?: string;
  dept?: string;
  alt_dept?: string;
}
export const pillarIds = ['S1', 'S2', 'S3', 'S4', 'S5'] as const;
function mean(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : null;
}
function pillarValues(audit: AnalyticsAudit): Array<number | null> {
  const source = audit.pillars_json;
  return pillarIds.map((id, index) => {
    const entry = Array.isArray(source) ? source[index] : source && typeof source === 'object' ? (source as Record<string, unknown>)[id] : null;
    if (!entry || typeof entry !== 'object') return null;
    const raw = (entry as Record<string, unknown>).pct ?? (entry as Record<string, unknown>).score;
    if (raw === undefined || raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  });
}
function aggregatePillars(audits: readonly AnalyticsAudit[]) {
  const rows = audits.map(pillarValues);
  return pillarIds.map((_, index) => mean(rows.map(row => row[index]).filter((value): value is number => value !== null)));
}
/** A derived view only: never edits audits, photos, areas or stored scores. */
export function buildAnalytics<T extends AnalyticsAudit>(audits: readonly T[], areas: readonly AnalyticsArea[], calculateLevel: (audit: T) => number) {
  const byId = new Map(areas.map(area => [area.id, area]));
  const groupedAudits = new Map<string, T[]>();
  for (const audit of audits) {
    const id = audit.area_id || `historical:${audit.area_name || audit.id}`;
    if (!byId.has(id)) byId.set(id, { id, name: audit.area_name || 'Arşiv bölgesi' });
    const group = groupedAudits.get(id) || [];
    group.push(audit);
    groupedAudits.set(id, group);
  }
  const rows = Array.from(byId.values()).map(area => {
    const records = groupedAudits.get(area.id) || [];
    return { ...area, count: records.length, score: mean(records.map(record => Number(record.total_score || 0))), level: mean(records.map(calculateLevel)), pillars: aggregatePillars(records) };
  });
  const groups = new Map<string, { name: string; areas: typeof rows }>();
  for (const area of rows) {
    const factory = area.fabrika || 'Diğer';
    const department = area.alt_dept || area.dept || 'Genel';
    const key = JSON.stringify([factory, department]);
    if (!groups.has(key)) groups.set(key, { name: `${factory} · ${department}`, areas: [] });
    groups.get(key)!.areas.push(area);
  }
  return { count: audits.length, level: mean(audits.map(calculateLevel)), pillars: aggregatePillars(audits), areas: rows, groups: Array.from(groups.values()) };
}

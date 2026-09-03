import { describe, expect, it } from 'vitest';
import { buildAnalytics } from './analytics';

describe('5S read-only reporting model', () => {
  const areas = [
    { id: 'a', name: 'Prova', fabrika: 'İzmir', dept: 'Üretim', alt_dept: 'Flexible' },
    { id: 'b', name: 'Prova', fabrika: 'İzmir', dept: 'Üretim', alt_dept: 'Tobacco' },
    { id: 'c', name: 'Bakım', fabrika: 'İzmir', dept: 'Operasyon' },
  ];
  it('keeps identical area names separate, and does not truncate after eight areas', () => {
    const manyAreas = Array.from({ length: 17 }, (_, i) => ({ id: String(i), name: 'Prova' }));
    const audits = manyAreas.map(area => ({ id: area.id, area_id: area.id }));
    const result = buildAnalytics(audits, manyAreas, () => 1.25);
    expect(result.areas).toHaveLength(17);
    expect(result.areas.every(area => area.level === 1.25)).toBe(true);
  });
  it('uses existing S-level calculation and preserves zero pillar scores', () => {
    const audits = [
      { id: '1', area_id: 'a', total_score: 80, pillars_json: { S1: { pct: 0 }, S2: { pct: '60' } } },
      { id: '2', area_id: 'a', total_score: 90, pillars_json: [{ pct: 100 }, { pct: 80 }] },
    ];
    const result = buildAnalytics(audits, areas, audit => audit.id === '1' ? 0 : 3.5);
    expect(result.areas[0].level).toBe(1.75);
    expect(result.areas[0].pillars).toEqual([50, 70, null, null, null]);
    expect(result.pillars).toEqual([50, 70, null, null, null]);
  });
  it('groups by factory and area-management department, with unaudited areas distinct from zero', () => {
    const result = buildAnalytics([{ id: '1', area_id: 'a' }], areas, () => 0);
    expect(result.groups.map(group => group.name)).toEqual(['İzmir · Flexible', 'İzmir · Tobacco', 'İzmir · Operasyon']);
    expect(result.areas[0].level).toBe(0);
    expect(result.areas[1].level).toBeNull();
  });
  it('does not mutate audits, photo references, area metadata or array order', () => {
    const audits = [{ id: 'a1', area_id: 'a', photos: [{ path: 'original/photo.jpg' }], pillars_json: { S1: { pct: 90 } } }];
    const before = JSON.stringify({ audits, areas });
    buildAnalytics(audits, areas, () => 1);
    expect(JSON.stringify({ audits, areas })).toBe(before);
  });
  it('retains orphaned historical records without merging them into a same-named area', () => {
    const result = buildAnalytics([{ id: '1', area_id: 'old', area_name: 'Prova' }], areas, () => 2);
    expect(result.areas.find(area => area.id === 'old')?.level).toBe(2);
    expect(result.areas.find(area => area.id === 'a')?.level).toBeNull();
  });
});

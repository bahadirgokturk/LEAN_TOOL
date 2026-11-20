import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync("public/kaizen-docs/index.html", "utf8");
const scoring = source.slice(source.indexOf("const SCORING_CRITERIA ="), source.indexOf("function resetFormView()"));
const exporter = source.slice(source.indexOf("function exportPDFRecord(r)"), source.indexOf("function exportPDF(id)"));
const escapeHelper = source.slice(source.indexOf("function esc(str)"), source.indexOf("function fmtDate(iso)"));
function render(overrides: Record<string, unknown> = {}) {
  let output = "";
  const record = { tur: "Point Kaizen", kaizenNo: "TEST-1", konu: "Test", tarih: "2026-11-20",
    score: 36, awardLider: 50, awardUyeler: 40,
    criteriaScores: { kazanc: 2, siklik: 25, efor: 5, ekip: 4 }, ...overrides };
  const original = JSON.stringify(record);
  runInNewContext(`${escapeHelper}\n${scoring}\n${exporter}\nexportPDFRecord(record);`, {
    record, KAZANC_OPTIONS: [], opexSrc: "", companySrc: "",
    fmtDate: () => "",
    window: { open: () => ({ document: { write: (html: string) => { output = html; }, close() {} } }) },
  });
  expect(JSON.stringify(record)).toBe(original);
  return output;
}
describe("Point Kaizen print scoring page", () => {
  it("prints saved criterion scores and rewards on a separate second page", () => {
    const output = render();
    expect(output).toContain("PUANLAMA DEĞERLENDİRMESİ");
    expect(output).toContain("break-before: page");
    expect(output).toContain("50 puan");
    expect(output).toContain("40 puan");
    expect(output).toMatch(/>25<\/td>/);
    expect(output).toContain("Orta");
  });
  it("does not invent missing historical criterion scores", () => {
    expect(render({ criteriaScores: undefined })).toContain("Kriter detayları bu eski kayıtta saklanmamış");
  });
  it("leaves rollout forms single-page", () => {
    expect(render({ tur: "Yaygınlaştırma" })).not.toContain("SCORING EVALUATION");
  });
  it("preserves zero scores and escapes user text", () => {
    const output = render({ criteriaScores: { siklik: 0 }, konu: '<img src=x>' });
    expect(output).toContain('<td>0</td>');
    expect(output).not.toContain('<img src=x>');
    expect(output).toContain('&lt;img src=x&gt;');
  });
});

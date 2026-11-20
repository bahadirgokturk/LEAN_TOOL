import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync("public/5s/js/app.js", "utf8");
const editor = readFileSync("public/5s/js/dashboard.js", "utf8");
function createScoring() {
  const context = createContext({ S: { typeOverrides: {} } });
  runInContext(source.slice(source.indexOf("const PW ="), source.indexOf("function getActiveTemplate(")), context);
  runInContext(source.slice(source.indexOf("function countToScore("), source.indexOf("// ── Yardımcı fonksiyonlar")), context);
  return context;
}

describe("normal question weight is two", () => {
  it.each([1, "1", 2, "2"])("normalizes %s without changing other question fields", weight => {
    const context = createScoring();
    const question = { text: "Question", type: "yn", w: weight, photo: false };
    expect(context.templateQuestionToInternal(question)).toEqual({ ...question, w: 2 });
    expect(question.w).toBe(weight);
  });
  it("preserves important and critical weights and uses no default ones", () => {
    const context = createScoring();
    for (const w of [3, 5]) expect(context.templateQuestionToInternal({ text: "Q", w }).w).toBe(w);
    expect(runInContext("DEFAULT_PILLARS.flatMap(p=>p.questions).some(q=>q.w===1)", context)).toBe(false);
  });
  it("calculates normal versus important scores using two and three", () => {
    const context = createScoring();
    runInContext("PILLARS[0].questions=[{text:'A',type:'yn',w:2},{text:'B',type:'yn',w:3}];", context);
    expect(context.calcPillar(0, ["evet", "hayır"])).toEqual({ pct: 40, contribution: 8 });
    expect(context.calcPillar(0, ["evet", null])).toEqual({ pct: 100, contribution: 20 });
  });
  it("offers Normal (2) and selects it for legacy questions", () => {
    const context = createScoring();
    runInContext(editor.slice(editor.indexOf("function _fmSoruRowHtml("), editor.indexOf("function ", editor.indexOf("function _fmSoruRowHtml(")+10)), context);
    const html = context._fmSoruRowHtml({ text: "Q", w: 1 });
    expect(html).toContain('value="2" selected>Normal (2)');
    expect(html).not.toContain("Normal (1)");
  });
});

import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync("public/5s/js/app.js", "utf8");
const context = createContext({ PILLARS: [1, 2, 3, 4, 5].map(n => ({ id: `S${n}` })) });
runInContext(source.slice(source.indexOf("function calculateSLevel("), source.indexOf("function showToast(")), context);
const level = (pillars: unknown) => context.calculateSLevel({ pillars_json: pillars });

describe("5S inclusive 80 percent threshold", () => {
  it.each([80, 85, 89, 90, 100])("passes %s percent", pct => {
    expect(context.pillarPassed(pct)).toBe(true);
    expect(level({ S1: { pct } })).toBe(1);
  });
  it("keeps the sequential barrier and fractional progress", () => {
    expect(context.pillarPassed(79.9)).toBe(false);
    expect(level({ S1: { pct: 75 }, S2: { pct: 100 } })).toBe(0.75);
    expect(level({ S1: { pct: 80 }, S2: { pct: 85 }, S3: { pct: 60 } })).toBe(2.6);
  });
  it("supports legacy arrays without modifying audit data", () => {
    const pillars = Array.from({ length: 5 }, () => Object.freeze({ pct: 80 }));
    Object.freeze(pillars);
    expect(level(pillars)).toBe(5);
    expect(pillars).toEqual(Array.from({ length: 5 }, () => ({ pct: 80 })));
    expect(level({})).toBe(0);
  });
});

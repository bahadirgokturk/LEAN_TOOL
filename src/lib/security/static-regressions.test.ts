import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("legacy security regressions", () => {
  it("normalizes imported group colors before persistence and SVG rendering", () => {
    const source = readFileSync(resolve(process.cwd(), "public/legacy-app.js"), "utf8");
    expect(source).toContain("color: normalizeGroupColor(f.color)");
    expect(source).toContain("patch.color = normalizeGroupColor(f.color)");
    expect(source).toContain("return normalizeGroupColor(c || '#888888')");
  });

  it("requires the server-managed Gemba admin role", () => {
    const source = readFileSync(resolve(process.cwd(), "public/gemba/admin.html"), "utf8");
    expect(source).toContain("user?.app_metadata");
    expect(source).toContain("roles.includes('gemba_admin')");
    expect(source).toContain("requireGembaAdmin(data.session)");
  });

  it("renders activity costs with the active project's currency", () => {
    const source = readFileSync(resolve(process.cwd(), "public/legacy-app.js"), "utf8");
    const markup = readFileSync(resolve(process.cwd(), "src/app/app/legacy-markup.ts"), "utf8");
    expect(source).toContain("function fmtMoney(n, currency = activeProjectCurrency())");
    expect(source).toContain("const currency=DS.getProject(pid)?.budget?.currency || 'TRY'");
    expect(source).toContain("renderActivityRow(r, isPM, currency)");
    expect(source).toContain("fmtMoney(act.cost.planned,currency)");
    expect(source).toContain("costHeading.textContent=`Maliyet (${currency})`");
    expect(source).toContain("plannedCostLabel.textContent=`Planlanan (${currency})`");
    expect(source).toContain("actualCostLabel.textContent=`Gerçekleşen (${currency})`");
    expect(markup).toContain('id="wbs-cost-heading"');
    expect(source).not.toContain("fmtMoney(act.cost.planned):'—'");
  });
});

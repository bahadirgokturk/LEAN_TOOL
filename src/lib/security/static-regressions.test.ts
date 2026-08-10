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
});

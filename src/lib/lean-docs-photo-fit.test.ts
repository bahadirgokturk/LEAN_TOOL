import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("public/kaizen-docs/index.html", "utf8");

describe("operation standard photo visibility", () => {
  it.each([
    "ekipman-img-preview", "ekipman-card-img", "sof-mini-card-img",
    "sof-row-foto-img", "lib-card-img", "isadim-photo", "footer-card-img",
  ])("keeps the entire photo visible in %s", (className) => {
    const fit = html.match(new RegExp(`\\.${className}\\s*\\{[\\s\\S]*?object-fit:\\s*(\\w+)`));
    expect(fit?.[1]).toBe("contain");
  });
});

import { describe, expect, it } from "vitest";
import { collectAuditPhotoPaths } from "./audit-photo-paths";

describe("collectAuditPhotoPaths", () => {
  it("extracts current, previous and legacy paths without duplicates", () => {
    const current = "2026-08-28/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg";
    const previous = "2026-08-20/33333333-3333-3333-3333-333333333333.webp";
    expect(collectAuditPhotoPaths({ 0: { 1: [`/api/s5/photos?path=${encodeURIComponent(current)}`, current, previous, "1720000000000-abcde.jpg"] } }))
      .toEqual([current, previous, "1720000000000-abcde.jpg"]);
  });

  it("rejects paths outside the 5S naming rules", () => {
    expect(collectAuditPhotoPaths(["../../secret", "https://example.com/image.jpg"])).toEqual([]);
  });
});

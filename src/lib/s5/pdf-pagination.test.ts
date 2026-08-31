import { describe, expect, it } from "vitest";
import { calculatePdfPageSlices } from "./pdf-pagination";

describe("calculatePdfPageSlices", () => {
  it("moves a marked row wholly onto the following page", () => {
    expect(calculatePdfPageSlices(2_000, 1_000, [{ top: 900, bottom: 1_100 }])).toEqual([
      { start: 0, height: 900 },
      { start: 900, height: 1_000 },
      { start: 1_900, height: 100 },
    ]);
  });

  it("uses normal page boundaries when no marked row is crossed", () => {
    expect(calculatePdfPageSlices(1_500, 1_000, [{ top: 700, bottom: 850 }])).toEqual([
      { start: 0, height: 1_000 },
      { start: 1_000, height: 500 },
    ]);
  });
});

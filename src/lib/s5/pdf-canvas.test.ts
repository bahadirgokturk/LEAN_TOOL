import { describe, expect, it } from "vitest";
import { hasVisibleCanvasPixels } from "./pdf-canvas";

describe("hasVisibleCanvasPixels", () => {
  it("rejects an all-white PDF canvas", () => {
    expect(hasVisibleCanvasPixels(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]))).toBe(false);
  });

  it("accepts a canvas containing report content", () => {
    expect(hasVisibleCanvasPixels(new Uint8ClampedArray([255, 255, 255, 255, 13, 34, 64, 255]))).toBe(true);
  });
});

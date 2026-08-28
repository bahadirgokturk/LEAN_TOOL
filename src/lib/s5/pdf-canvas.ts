/** True when a rendered canvas contains something other than a white background. */
export function hasVisibleCanvasPixels(pixels: Uint8ClampedArray): boolean {
  // Sampling keeps the guard cheap even for a multi-megapixel audit report.
  const pixelCount = Math.floor(pixels.length / 4);
  const stride = Math.max(1, Math.floor(pixelCount / 50_000));
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    const offset = pixel * 4;
    if (pixels[offset + 3] > 0 &&
        (pixels[offset] < 245 || pixels[offset + 1] < 245 || pixels[offset + 2] < 245)) {
      return true;
    }
  }
  return false;
}

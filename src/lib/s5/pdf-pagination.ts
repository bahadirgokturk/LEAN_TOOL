export type PdfKeepRange = {
  top: number;
  bottom: number;
};

export type PdfPageSlice = {
  start: number;
  height: number;
};

/** Splits a rendered report without cutting through marked form rows. */
export function calculatePdfPageSlices(
  totalHeight: number,
  maximumPageHeight: number,
  keepRanges: PdfKeepRange[]
): PdfPageSlice[] {
  const slices: PdfPageSlice[] = [];
  const safePageHeight = Math.max(1, Math.floor(maximumPageHeight));
  let start = 0;

  while (start < totalHeight) {
    let end = Math.min(totalHeight, start + safePageHeight);
    if (end < totalHeight) {
      const crossingRange = keepRanges
        .filter((range) => range.top > start && range.top < end && range.bottom > end)
        .sort((left, right) => left.top - right.top)[0];
      if (crossingRange) end = crossingRange.top;
    }

    // A malformed or page-taller range must never cause an infinite loop.
    if (end <= start) end = Math.min(totalHeight, start + safePageHeight);
    slices.push({ start, height: end - start });
    start = end;
  }

  return slices;
}

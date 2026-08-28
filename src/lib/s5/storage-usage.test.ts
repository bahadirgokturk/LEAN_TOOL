import { describe, expect, it } from "vitest";
import { createStorageUsage, S5_STORAGE_LIMIT_BYTES } from "./storage-usage";

describe("createStorageUsage", () => {
  it("calculates free-plan usage as a percentage", () => {
    expect(createStorageUsage(567_000_000, 1950, 100)).toEqual({
      usedBytes: 567_000_000,
      limitBytes: S5_STORAGE_LIMIT_BYTES,
      percent: 56.7,
      photoCount: 1950,
      auditCount: 100,
    });
  });

  it("clamps invalid and over-limit values", () => {
    expect(createStorageUsage(-5, "bad", null).percent).toBe(0);
    expect(createStorageUsage(2_000_000_000, 1, 1).percent).toBe(100);
  });
});

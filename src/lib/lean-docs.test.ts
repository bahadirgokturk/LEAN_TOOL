import { describe, expect, it } from "vitest";
import { exposePayloadImages, isValidMediaPath, leanDocSchema } from "./lean-docs";

describe("lean documents boundary", () => {
  it("rejects unknown record types", () => {
    expect(leanDocSchema.safeParse({ id: 1, recordType: "unknown", payload: {} }).success).toBe(false);
  });

  it("normalizes numeric ids", () => {
    const parsed = leanDocSchema.parse({ id: 123, recordType: "equipment", payload: {} });
    expect(parsed.id).toBe("123");
  });

  it("only accepts scoped storage object paths", () => {
    const path = "123e4567-e89b-12d3-a456-426614174000/2026-08-24/123e4567-e89b-12d3-a456-426614174001.jpg";
    expect(isValidMediaPath(path)).toBe(true);
    expect(isValidMediaPath("../secret.jpg")).toBe(false);
  });

  it("exposes media markers through the authenticated endpoint", () => {
    const payload = exposePayloadImages({ photo: "lean-media://123e4567-e89b-12d3-a456-426614174000/2026-08-24/123e4567-e89b-12d3-a456-426614174001.jpg" });
    expect(payload).toEqual({
      photo: "/api/lean-docs/media?path=123e4567-e89b-12d3-a456-426614174000%2F2026-08-24%2F123e4567-e89b-12d3-a456-426614174001.jpg",
    });
  });
});

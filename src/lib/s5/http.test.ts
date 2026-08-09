import { describe, expect, it } from "vitest";
import { readIntParam, readPaginationParams } from "./http";

const bounds = { fallback: 200, min: 1, max: 500 };

describe("readIntParam", () => {
  it("uses the fallback when the parameter is missing", () => {
    expect(readIntParam(new URLSearchParams(), "limit", bounds)).toBe(200);
  });

  it("uses the fallback when the parameter is empty or invalid", () => {
    expect(readIntParam(new URLSearchParams("limit="), "limit", bounds)).toBe(200);
    expect(readIntParam(new URLSearchParams("limit=invalid"), "limit", bounds)).toBe(200);
  });

  it("truncates decimals and clamps values to the configured bounds", () => {
    expect(readIntParam(new URLSearchParams("limit=25.9"), "limit", bounds)).toBe(25);
    expect(readIntParam(new URLSearchParams("limit=0"), "limit", bounds)).toBe(1);
    expect(readIntParam(new URLSearchParams("limit=900"), "limit", bounds)).toBe(500);
  });
});

describe("readPaginationParams", () => {
  it("returns the shared defaults and respects explicit values", () => {
    expect(readPaginationParams(new URLSearchParams())).toEqual({ limit: 200, offset: 0 });
    expect(readPaginationParams(new URLSearchParams("limit=50&offset=25"))).toEqual({
      limit: 50,
      offset: 25,
    });
  });
});

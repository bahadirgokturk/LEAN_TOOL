import { describe, expect, it } from "vitest";
import { hasApprovedAccess } from "./access";

describe("internal tool access approval", () => {
  it("rejects an authenticated but unapproved user", () => {
    expect(hasApprovedAccess({ app_metadata: { provider: "email" } })).toBe(false);
  });

  it("rejects string-shaped truthy values", () => {
    expect(hasApprovedAccess({ app_metadata: { access_approved: "true" } })).toBe(false);
  });

  it("accepts only an administrator-approved user", () => {
    expect(hasApprovedAccess({ app_metadata: { access_approved: true } })).toBe(true);
  });
});

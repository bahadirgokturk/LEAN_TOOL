import { afterEach, describe, expect, it } from "vitest";
import { getTrustedAppOrigin } from "./route";

describe("notification link origin", () => {
  afterEach(() => {
    delete process.env.APP_ORIGIN;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("uses the configured canonical HTTPS origin", () => {
    process.env.APP_ORIGIN = "https://staging.lean.example/some/path";
    expect(getTrustedAppOrigin()).toBe("https://staging.lean.example");
  });

  it("rejects insecure remote origins", () => {
    process.env.APP_ORIGIN = "http://attacker.example";
    expect(() => getTrustedAppOrigin()).toThrow(/HTTPS/);
  });
});

import { describe, expect, it } from "vitest";
import {
  createRecoveryFragmentBridge,
  getRecoveryRedirect,
} from "./recovery";

describe("password recovery fragment handling", () => {
  it("sends implicit recovery fragments to the new password screen", () => {
    expect(getRecoveryRedirect("#type=recovery&access_token=token")).toBe(
      "/reset-password#type=recovery&access_token=token"
    );
    expect(getRecoveryRedirect("#access_token=token&refresh_token=refresh")).toBe(
      "/reset-password#access_token=token&refresh_token=refresh"
    );
  });

  it("ignores ordinary and malformed fragments", () => {
    expect(getRecoveryRedirect("")).toBeNull();
    expect(getRecoveryRedirect("#section=projects")).toBeNull();
    expect(getRecoveryRedirect("access_token=missing-hash")).toBeNull();
  });

  it("creates a no-store browser bridge that preserves the recovery fragment", async () => {
    const response = createRecoveryFragmentBridge(
      "https://lean.example",
      "/login?error=auth_callback_failed"
    );
    const html = await response.text();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("/reset-password");
    expect(html).toContain("window.location.hash");
    expect(html).toContain("/login?error=auth_callback_failed");
  });
});

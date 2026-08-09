import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthLinkRoute,
  establishSessionFromLink,
  readOtpType,
  resolveRedirect,
} from "./redirect";

const { createClientMock, exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
const supabase = {
  auth: { exchangeCodeForSession, verifyOtp },
} as unknown as SupabaseClient;

describe("authentication link redirects", () => {
  it("allows only known application destinations", () => {
    expect(resolveRedirect("/reset-password")).toBe("/reset-password");
    expect(resolveRedirect("/api/s5/users")).toBe("/app");
    expect(resolveRedirect("https://attacker.example")).toBe("/app");
    expect(resolveRedirect(null)).toBe("/app");
  });

  it("accepts only supported OTP types", () => {
    expect(readOtpType("recovery")).toBe("recovery");
    expect(readOtpType("magiclink")).toBe("magiclink");
    expect(readOtpType("unsupported")).toBeNull();
    expect(readOtpType(null)).toBeNull();
  });
});

describe("establishSessionFromLink", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
  });

  it("exchanges a PKCE authorization code", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(establishSessionFromLink(supabase, { code: "auth-code" })).resolves.toEqual({
      ok: true,
    });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE token delivered in the token hash slot", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    await expect(
      establishSessionFromLink(supabase, { tokenHash: "pkce_token" })
    ).resolves.toEqual({ ok: true });
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce_token");
  });

  it("verifies a classic OTP token hash", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    await expect(
      establishSessionFromLink(supabase, { tokenHash: "otp-hash", type: "recovery" })
    ).resolves.toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "otp-hash" });
  });

  it("falls back from a failed code exchange to OTP verification", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    verifyOtp.mockResolvedValue({ error: null });

    await expect(
      establishSessionFromLink(supabase, {
        code: "invalid-code",
        tokenHash: "otp-hash",
        type: "invite",
      })
    ).resolves.toEqual({ ok: true });
  });

  it("fails closed when no supported credential establishes a session", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid") });
    verifyOtp.mockResolvedValue({ error: new Error("expired") });

    await expect(
      establishSessionFromLink(supabase, { tokenHash: "expired", type: "recovery" })
    ).resolves.toEqual({ ok: false });
    await expect(establishSessionFromLink(supabase, {})).resolves.toEqual({ ok: false });
  });
});

describe("createAuthLinkRoute", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    exchangeCodeForSession.mockReset();
    verifyOtp.mockReset();
    createClientMock.mockResolvedValue(supabase);
  });

  it("redirects a successful link only to an allowed destination", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const handler = createAuthLinkRoute("auth_callback_failed");

    const response = await handler(
      new Request("https://lean.example/auth/callback?code=valid&next=/reset-password")
    );

    expect(response.headers.get("location")).toBe("https://lean.example/reset-password");
  });

  it("keeps the route-specific failure code", async () => {
    const handler = createAuthLinkRoute("auth_confirm_failed");

    const response = await handler(new Request("https://lean.example/auth/confirm"));

    expect(response.headers.get("location")).toBe(
      "https://lean.example/login?error=auth_confirm_failed"
    );
  });
});

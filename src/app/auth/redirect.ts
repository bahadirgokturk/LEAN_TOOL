import { type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Shared helpers for the two email-link callback routes. */

/** Destinations an email link is allowed to land on. */
const ALLOWED_REDIRECTS = new Set(["/app", "/reset-password", "/"]);

/**
 * Constrains the `next` parameter to a known page.
 *
 * `${origin}${next}` already prevents an off-site redirect, but an unvalidated
 * value could still point a freshly authenticated session at an API route.
 */
export function resolveRedirect(next: string | null): string {
  return next && ALLOWED_REDIRECTS.has(next) ? next : "/app";
}

/** Email OTP types this application issues. */
const OTP_TYPES = ["recovery", "signup", "invite", "magiclink", "email_change"] as const;

export function readOtpType(value: string | null): EmailOtpType | null {
  return value && (OTP_TYPES as readonly string[]).includes(value)
    ? (value as EmailOtpType)
    : null;
}

/**
 * Turns whatever credential an email link carries into a session.
 *
 * Supabase issues three shapes depending on the project's flow type and email
 * template, and links in the wild mix them:
 *
 *   `code`             — PKCE authorisation code
 *   `pkce_…` token     — a PKCE code delivered in the `token_hash` slot; it must
 *                        be exchanged, not verified (verifyOtp rejects it)
 *   plain `token_hash` — classic OTP hash, verified with the OTP type
 *
 * Handling all three here means the flow keeps working regardless of how the
 * email template is configured.
 */
export async function establishSessionFromLink(
  supabase: SupabaseClient,
  params: { code?: string | null; tokenHash?: string | null; type?: EmailOtpType | null }
): Promise<{ ok: boolean }> {
  const { code, tokenHash, type } = params;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return { ok: true };
  }

  if (tokenHash?.startsWith("pkce_")) {
    const { error } = await supabase.auth.exchangeCodeForSession(tokenHash);
    if (!error) return { ok: true };
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return { ok: true };
  }

  return { ok: false };
}

type AuthLinkFailure = "auth_callback_failed" | "auth_confirm_failed";

/** Creates either email-link route while preserving its route-specific error code. */
export function createAuthLinkRoute(failureCode: AuthLinkFailure) {
  return async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = resolveRedirect(searchParams.get("next"));

    const supabase = await createClient();
    const { ok } = await establishSessionFromLink(supabase, {
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      type: readOtpType(searchParams.get("type")),
    });

    if (ok) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${failureCode}`);
  };
}

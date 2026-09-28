import { type EmailOtpType, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRecoveryFragmentBridge } from "@/lib/auth/recovery";

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

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Returns a human-confirmation page without verifying the one-time token.
 * Corporate mail security scanners commonly prefetch GET links; verification
 * therefore happens only after the real user submits this form.
 */
function createHumanConfirmationPage(searchParams: URLSearchParams): Response {
  const hiddenFields = ["token_hash", "type", "next"]
    .map((name) => {
      const value = searchParams.get(name) ?? "";
      return `<input type="hidden" name="${name}" value="${escapeHtmlAttribute(value)}">`;
    })
    .join("");
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Şifre yenileme</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b2948;font-family:Arial,sans-serif;color:#092744}.card{width:min(420px,calc(100% - 40px));box-sizing:border-box;background:#fff;border-radius:22px;padding:36px;box-shadow:0 24px 70px #00162e66}.brand{color:#f4511e;font-weight:800;letter-spacing:.12em;font-size:13px}h1{font-size:28px;margin:14px 0 10px}p{color:#5f6f82;line-height:1.55;margin:0 0 24px}button{width:100%;border:0;border-radius:12px;background:#174f80;color:#fff;font-size:16px;font-weight:700;padding:15px;cursor:pointer}small{display:block;color:#7a8796;margin-top:18px;text-align:center}</style></head><body><main class="card"><div class="brand">SAUERESSIG OPEX</div><h1>Şifrenizi yenileyin</h1><p>Bağlantıyı siz açtıysanız aşağıdaki düğmeye basın. Güvenlik amacıyla bağlantı ancak bu işlemden sonra kullanılacaktır.</p><form method="post" action="/auth/confirm">${hiddenFields}<button type="submit">Şifre yenilemeye devam et</button></form><small>Bu isteği siz oluşturmadıysanız sayfayı kapatabilirsiniz.</small></main></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * Implicit-flow recovery credentials are placed after `#`, which browsers do
 * not send to a server route. This tiny same-origin bridge lets the browser
 * carry that fragment to the client-side reset page, where supabase-js can
 * consume it and establish the recovery session.
 */
/** Creates either email-link route while preserving its route-specific error code. */
export function createAuthLinkRoute(
  failureCode: AuthLinkFailure,
  redirectStatus: 303 | 307 = 307
) {
  return async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = resolveRedirect(searchParams.get("next"));

    // A URL fragment never reaches this server. When there are no query-based
    // credentials, give implicit recovery links one client-side hop instead of
    // incorrectly rejecting them and bouncing straight back to login.
    if (
      failureCode === "auth_callback_failed" &&
      !searchParams.has("code") &&
      !searchParams.has("token_hash")
    ) {
      return createRecoveryFragmentBridge(origin, `/login?error=${failureCode}`);
    }

    const supabase = await createClient();
    const { ok } = await establishSessionFromLink(supabase, {
      code: searchParams.get("code"),
      tokenHash: searchParams.get("token_hash"),
      type: readOtpType(searchParams.get("type")),
    });

    if (ok) return NextResponse.redirect(`${origin}${next}`, redirectStatus);
    return NextResponse.redirect(
      `${origin}/login?error=${failureCode}`,
      redirectStatus
    );
  };
}

/** Creates an email-link route protected from automatic mail-link prefetching. */
export function createHumanConfirmedAuthLinkRoute(failureCode: AuthLinkFailure) {
  const verify = createAuthLinkRoute(failureCode);
  const verifyPost = createAuthLinkRoute(failureCode, 303);

  return {
    async get(request: Request) {
      const url = new URL(request.url);
      if (
        url.searchParams.get("type") === "recovery" &&
        url.searchParams.has("token_hash")
      ) {
        return createHumanConfirmationPage(url.searchParams);
      }
      return verify(request);
    },
    async post(request: Request) {
      const formData = await request.formData();
      const url = new URL(request.url);
      for (const name of ["token_hash", "type", "next"] as const) {
        const value = formData.get(name);
        if (typeof value === "string") url.searchParams.set(name, value);
      }
      return verifyPost(new Request(url));
    },
  };
}

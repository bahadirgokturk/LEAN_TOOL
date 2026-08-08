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

export function readOtpType(value: string | null): string | null {
  return value && (OTP_TYPES as readonly string[]).includes(value) ? value : null;
}

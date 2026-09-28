const RECOVERY_PATH = "/reset-password";

/** Direct destination used in newly issued password-recovery emails. */
export function getPasswordResetRedirect(origin: string): string {
  return `${origin}${RECOVERY_PATH}`;
}

/**
 * Maps malformed paths emitted by the project's older Supabase email template
 * back to the real confirmation route. Query credentials are preserved by the
 * caller. The canonical path is deliberately excluded to avoid redirect loops.
 */
export function normalizeLegacyAuthConfirmPath(pathname: string): string | null {
  return pathname !== "/auth/confirm" && pathname.endsWith("/auth/confirm")
    ? "/auth/confirm"
    : null;
}

/** Returns the same-origin destination for an implicit Supabase recovery hash. */
export function getRecoveryRedirect(hash: string): string | null {
  if (!hash.startsWith("#")) return null;

  const params = new URLSearchParams(hash.slice(1));
  const isRecovery =
    params.get("type") === "recovery" ||
    (params.has("access_token") && params.has("refresh_token"));

  return isRecovery ? `${RECOVERY_PATH}${hash}` : null;
}

/**
 * Preserves URL fragments that a server redirect cannot see.
 *
 * Supabase implicit-flow credentials live after `#`. If an email provider
 * falls back to the Site URL, an ordinary server redirect would discard them
 * before the browser client can establish the recovery session.
 */
export function createRecoveryFragmentBridge(origin: string, fallbackPath: string): Response {
  const resetUrl = JSON.stringify(`${origin}${RECOVERY_PATH}`);
  const fallbackUrl = JSON.stringify(`${origin}${fallbackPath}`);
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bağlantı doğrulanıyor</title></head><body><p>Şifre sıfırlama bağlantısı doğrulanıyor...</p><script>(function(){var h=window.location.hash||'';var p=new URLSearchParams(h.slice(1));var recovery=p.get('type')==='recovery'||(p.has('access_token')&&p.has('refresh_token'));window.location.replace((recovery?${resetUrl}:${fallbackUrl})+(recovery?h:''));})();</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

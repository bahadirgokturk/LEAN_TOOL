import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveRedirect, readOtpType } from "../redirect";

/**
 * Device-independent email link verification (password reset, invite, signup).
 *
 * Unlike the PKCE code flow, `verifyOtp` needs no `code_verifier` cookie, so a
 * link opened on a phone while the reset was requested on a desktop still works.
 *
 * The Supabase email template points here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = readOtpType(searchParams.get("type"));
  const next = resolveRedirect(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { establishSessionFromLink, readOtpType, resolveRedirect } from "../redirect";

/**
 * Verifies an email link (password reset, invite, signup confirmation) and
 * establishes the session before handing the user to the target page.
 *
 * Accepts every credential shape Supabase may send — see
 * {@link establishSessionFromLink}.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = resolveRedirect(searchParams.get("next"));

  const supabase = await createClient();
  const { ok } = await establishSessionFromLink(supabase, {
    code: searchParams.get("code"),
    tokenHash: searchParams.get("token_hash"),
    type: readOtpType(searchParams.get("type")),
  });

  if (ok) return NextResponse.redirect(`${origin}${next}`);
  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { establishSessionFromLink, readOtpType, resolveRedirect } from "../redirect";

/**
 * Magic-link and OAuth style callback. Shares its credential handling with
 * /auth/confirm so both entry points behave identically.
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
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

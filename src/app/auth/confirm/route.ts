import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cihazdan bağımsız e-posta bağlantısı doğrulaması (şifre sıfırlama, davet,
// e-posta onayı). PKCE code-flow'un aksine verifyOtp bir "code_verifier" çerezi
// gerektirmez — bu yüzden linki telefonda/başka tarayıcıda açmak da çalışır.
//
// E-posta şablonu bu route'a şöyle bağlanır:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth_confirm_failed`
  );
}

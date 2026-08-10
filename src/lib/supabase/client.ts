import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * Uses the implicit flow rather than the default PKCE flow. PKCE requires a
 * `code_verifier` cookie that only exists in the exact browser where the flow
 * started, so PKCE-based password-reset links break whenever the email is
 * opened in a different browser or an email-app's in-app browser — which is the
 * common case. Implicit-flow recovery links carry a `token_hash` that the
 * server verifies with `verifyOtp`, needing no verifier, so they work anywhere.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}

import { createAuthLinkRoute } from "../redirect";

/**
 * Verifies an email link (password reset, invite, signup confirmation) and
 * establishes the session before handing the user to the target page.
 *
 * Accepts every credential shape Supabase may send — see
 * {@link establishSessionFromLink}.
 */
export const GET = createAuthLinkRoute("auth_confirm_failed");

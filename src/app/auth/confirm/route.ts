import { createHumanConfirmedAuthLinkRoute } from "../redirect";

/**
 * Verifies an email link (password reset, invite, signup confirmation) and
 * establishes the session before handing the user to the target page.
 *
 * Accepts every credential shape Supabase may send — see
 * {@link establishSessionFromLink}.
 */
const handlers = createHumanConfirmedAuthLinkRoute("auth_confirm_failed");

export const GET = handlers.get;
export const POST = handlers.post;

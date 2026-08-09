import { createAuthLinkRoute } from "../redirect";

/**
 * Magic-link and OAuth style callback. Shares its credential handling with
 * /auth/confirm so both entry points behave identically.
 */
export const GET = createAuthLinkRoute("auth_callback_failed");

type AuthUserLike = {
  app_metadata?: Record<string, unknown> | null;
} | null | undefined;

/**
 * Email confirmation proves mailbox control only. Internal-tool access is a
 * separate administrator decision stored in immutable app_metadata.
 */
export function hasApprovedAccess(user: AuthUserLike): boolean {
  return user?.app_metadata?.access_approved === true;
}

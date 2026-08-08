import { NextResponse, type NextRequest } from "next/server";
import { requireRole, requireUser, type S5Role, type S5User } from "./auth";
import { toErrorResponse } from "./http";

/**
 * Wraps a 5S route handler with authentication, role checks and error mapping.
 *
 * Declaring the required roles in the route definition — rather than as the
 * first lines of each handler body — means a handler cannot be shipped with its
 * guard accidentally omitted.
 *
 * @example
 * export const DELETE = protectedRoute<{ id: string }>(
 *   { roles: ["admin"] },
 *   async ({ params }) => { ... }
 * );
 */
type HandlerContext<TParams> = {
  req: NextRequest;
  user: S5User;
  params: TParams;
};

type Handler<TParams> = (context: HandlerContext<TParams>) => Promise<NextResponse>;

export function protectedRoute<TParams = Record<string, never>>(
  options: { roles?: S5Role[] },
  handler: Handler<TParams>
) {
  return async (req: NextRequest, routeContext: { params: Promise<TParams> }) => {
    try {
      const user = requireUser(req);
      if (options.roles) requireRole(user, ...options.roles);
      const params = ((await routeContext?.params) ?? {}) as TParams;
      return await handler({ req, user, params });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Same wrapper for endpoints that must stay reachable without a session. */
export function publicRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

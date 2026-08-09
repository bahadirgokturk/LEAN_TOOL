import type { NextRequest } from "next/server";
import type { S5Role, S5User } from "@/lib/s5/auth";

export const ROLE_TEST_SECRET = "test-secret-that-is-long-enough-for-route-tests";
export const S5_TEST_ROLES: S5Role[] = ["admin", "denetci", "departman", "takimlider"];

export type TestRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, never>> }
) => Promise<Response>;

export function createRoleTestUser(role: S5Role, plant = "Plant A"): S5User {
  return {
    id: `${role}-1`,
    username: `${role}.user`,
    name: `${role} user`,
    role,
    plant,
    department: "Assembly",
    section: "Line 1",
  };
}

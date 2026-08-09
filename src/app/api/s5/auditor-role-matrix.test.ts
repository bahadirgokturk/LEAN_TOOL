import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, type S5Role } from "@/lib/s5/auth";
import { POST as createAction } from "./actions/route";
import { POST as createAudit } from "./audits/route";
import {
  createRoleTestUser,
  ROLE_TEST_SECRET,
  S5_TEST_ROLES,
  type TestRouteHandler,
} from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

const writeRoutes: Array<{
  name: string;
  path: string;
  handler: TestRouteHandler;
  body: Record<string, unknown>;
  successfulQueryCount: number;
}> = [
  {
    name: "action creation",
    path: "/api/s5/actions",
    handler: createAction,
    body: { area_id: "area-1", description: "Replace missing label" },
    successfulQueryCount: 1,
  },
  {
    name: "audit creation",
    path: "/api/s5/audits",
    handler: createAudit,
    body: { area_id: "area-1", date: "2026-08-09", total_score: 85 },
    successfulQueryCount: 2,
  },
];

async function invoke(
  handler: TestRouteHandler,
  path: string,
  body: Record<string, unknown>,
  role: S5Role
): Promise<Response> {
  const request = new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(createRoleTestUser(role))}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handler(request, { params: Promise.resolve({}) });
}

describe("5S auditor write route matrix", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: "result" }], rowCount: 1 });
  });

  for (const route of writeRoutes) {
    it.each(S5_TEST_ROLES)(`${route.name} applies the expected access rule to %s`, async (role) => {
      const response = await invoke(route.handler, route.path, route.body, role);
      const canWrite = role === "admin" || role === "denetci";

      expect(response.status).toBe(canWrite ? 201 : 403);
      expect(queryMock).toHaveBeenCalledTimes(canWrite ? route.successfulQueryCount : 0);
    });
  }
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, type S5Role } from "@/lib/s5/auth";
import { GET as listUsers } from "./users/route";
import { POST as createArea } from "./areas/route";
import { POST as createForm } from "./forms/route";
import {
  createRoleTestUser,
  ROLE_TEST_SECRET,
  S5_TEST_ROLES,
  type TestRouteHandler,
} from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

type RouteCase = {
  name: string;
  method: "GET" | "POST";
  path: string;
  handler: TestRouteHandler;
  body?: Record<string, unknown>;
  successStatus: number;
};

const adminOnlyRoutes: RouteCase[] = [
  {
    name: "user list",
    method: "GET",
    path: "/api/s5/users",
    handler: listUsers,
    successStatus: 200,
  },
  {
    name: "area creation",
    method: "POST",
    path: "/api/s5/areas",
    handler: createArea,
    body: { id: "area-1", name: "Assembly" },
    successStatus: 201,
  },
  {
    name: "form template creation",
    method: "POST",
    path: "/api/s5/forms",
    handler: createForm,
    body: { adi: "Standard 5S", pillarlar: [] },
    successStatus: 201,
  },
];

async function invoke(route: RouteCase, role: S5Role): Promise<Response> {
  const token = signToken(createRoleTestUser(role));
  const request = new NextRequest(`http://localhost${route.path}`, {
    method: route.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(route.body ? { "content-type": "application/json" } : {}),
    },
    body: route.body ? JSON.stringify(route.body) : undefined,
  });
  return route.handler(request, { params: Promise.resolve({}) });
}

describe("5S admin-only route matrix", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: "result" }], rowCount: 1 });
  });

  for (const route of adminOnlyRoutes) {
    it.each(S5_TEST_ROLES)(`${route.name} applies the expected access rule to %s`, async (role) => {
      const response = await invoke(route, role);
      const expectedStatus = role === "admin" ? route.successStatus : 403;

      expect(response.status).toBe(expectedStatus);
      expect(queryMock).toHaveBeenCalledTimes(role === "admin" ? 1 : 0);
    });
  }
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, type S5Role, type S5User } from "@/lib/s5/auth";
import { GET as listActions } from "./actions/route";
import { GET as listAudits } from "./audits/route";
import {
  createRoleTestUser,
  ROLE_TEST_SECRET,
  S5_TEST_ROLES,
  type TestRouteHandler,
} from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

const readRoutes: Array<{ name: string; path: string; handler: TestRouteHandler }> = [
  { name: "actions", path: "/api/s5/actions", handler: listActions },
  { name: "audits", path: "/api/s5/audits", handler: listAudits },
];

async function invoke(route: (typeof readRoutes)[number], user: S5User): Promise<Response> {
  const request = new NextRequest(`http://localhost${route.path}`, {
    headers: { authorization: `Bearer ${signToken(user)}` },
  });
  return route.handler(request, { params: Promise.resolve({}) });
}

function expectedQueryValues(role: S5Role): unknown[] {
  if (role === "admin") return [200, 0];
  if (role === "denetci") return ["denetci-1", 200, 0];
  return ["Plant A", "Assembly", 200, 0];
}

describe("5S read visibility matrix", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  for (const route of readRoutes) {
    it.each(S5_TEST_ROLES)(`${route.name} scopes visible rows for %s`, async (role) => {
      const response = await invoke(route, createRoleTestUser(role));

      expect(response.status).toBe(200);
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0]?.[1]).toEqual(expectedQueryValues(role));
    });

    it.each(["departman", "takimlider"] as const)(
      `${route.name} rejects %s without a plant assignment`,
      async (role) => {
        const response = await invoke(route, createRoleTestUser(role, ""));

        expect(response.status).toBe(403);
        expect(queryMock).not.toHaveBeenCalled();
      }
    );
  }
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/s5/auth";
import { GET as getArea } from "./areas/[id]/route";
import { GET as getAudit } from "./audits/[id]/route";
import { GET as listPlans } from "./audits/plans/list/route";
import { createRoleTestUser, ROLE_TEST_SECRET } from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

function request(path: string) {
  const token = signToken(createRoleTestUser("departman"));
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("5S object-level authorization regressions", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("scopes area details by plant and department", async () => {
    await getArea(request("/api/s5/areas/foreign"), { params: Promise.resolve({ id: "foreign" }) });

    expect(queryMock.mock.calls[0]?.[0]).toContain("fabrika");
    expect(queryMock.mock.calls[0]?.[0]).toContain("dept");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["foreign", "Plant A", "Assembly"]);
  });

  it("scopes audit plans by their joined area", async () => {
    await listPlans(request("/api/s5/audits/plans/list"), { params: Promise.resolve({}) });

    expect(queryMock.mock.calls[0]?.[0]).toContain("LEFT JOIN s5_areas ar");
    expect(queryMock.mock.calls[0]?.[1]).toEqual(["Plant A", "Assembly"]);
  });

  it("denies an audit from another department in the same plant", async () => {
    queryMock.mockResolvedValue({
      rows: [{ id: "audit-2", auditor_id: "auditor-2", area_fabrika: "Plant A", dept: "Paint" }],
      rowCount: 1,
    });

    const response = await getAudit(request("/api/s5/audits/audit-2"), {
      params: Promise.resolve({ id: "audit-2" }),
    });

    expect(response.status).toBe(403);
  });
});

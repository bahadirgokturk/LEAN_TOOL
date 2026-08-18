import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/s5/auth";
import { DELETE as deleteAudit } from "./audits/[id]/route";
import { DELETE as deleteUser } from "./users/[id]/route";
import { DELETE as deleteArea } from "./areas/[id]/route";
import { createRoleTestUser, ROLE_TEST_SECRET } from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${signToken(createRoleTestUser("admin"))}` },
  });
}

/**
 * Deleting a user or an area does not delete audits, it unlinks them — and an
 * unlinked audit drops out of the lists its auditor and plant-scoped colleagues
 * see. Both deletes must therefore stop and say so while history exists.
 */
describe("protecting audit history from unlinking deletes", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
  });

  it("refuses to delete a user who has recorded audits", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: "4" }], rowCount: 1 });

    const response = await deleteUser(request("/api/s5/users/user-9"), {
      params: Promise.resolve({ id: "user-9" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("4 denetimi"),
    });
    // The count query must be the only statement — nothing may be deleted.
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deletes the user when the admin confirms with force", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 1 });

    const response = await deleteUser(request("/api/s5/users/user-9?force=1"), {
      params: Promise.resolve({ id: "user-9" }),
    });

    expect(response.status).toBe(200);
    expect(String(queryMock.mock.calls[0][0])).toContain("DELETE FROM s5_users");
  });

  it("archives an audit rather than deleting the row", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 1 });

    const response = await deleteAudit(request("/api/s5/audits/audit-1"), {
      params: Promise.resolve({ id: "audit-1" }),
    });

    expect(response.status).toBe(200);
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).not.toContain("DELETE");
    expect(sql).toContain("status='iptal'");
  });

  it("refuses to delete an area that still has audits", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: "12" }], rowCount: 1 });

    const response = await deleteArea(request("/api/s5/areas/area-1"), {
      params: Promise.resolve({ id: "area-1" }),
    });

    expect(response.status).toBe(409);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deletes an area with no audit history without a second confirmation", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ count: "0" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const response = await deleteArea(request("/api/s5/areas/area-1"), {
      params: Promise.resolve({ id: "area-1" }),
    });

    expect(response.status).toBe(200);
  });
});

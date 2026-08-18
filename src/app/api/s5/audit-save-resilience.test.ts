import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/s5/auth";
import { POST as createAudit } from "./audits/route";
import { createRoleTestUser, ROLE_TEST_SECRET } from "./role-test-helpers";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/s5/db")>("@/lib/s5/db");
  return { ...actual, query: queryMock };
});

/** Postgres reports a reference to a column the table does not have as 42703. */
function undefinedColumnError() {
  return Object.assign(new Error('column "form_template_id" of relation "s5_audits" does not exist'), {
    code: "42703",
  });
}

function auditRequest() {
  return new NextRequest("http://localhost/api/s5/audits", {
    method: "POST",
    headers: {
      authorization: `Bearer ${signToken(createRoleTestUser("denetci"))}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      area_id: "area-1",
      date: "2026-08-18",
      total_score: 72,
      answers_json: { "0": ["evet"] },
      form_template_id: "template-1",
    }),
  });
}

describe("saving an audit against a database missing the migration", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    queryMock.mockReset();
  });

  it("still stores the audit when s5_audits.form_template_id does not exist", async () => {
    queryMock
      .mockRejectedValueOnce(undefinedColumnError())
      .mockResolvedValue({ rows: [{ id: "audit-1" }], rowCount: 1 });

    const response = await createAudit(auditRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ id: "audit-1" });

    // The retry must drop only that column — every answer still has to be written.
    const retrySql = String(queryMock.mock.calls[1][0]);
    expect(retrySql).not.toContain("form_template_id");
    expect(retrySql).toContain("answers_json");
    expect(queryMock.mock.calls[1][1]).toHaveLength(15);
  });

  it("does not swallow unrelated database failures", async () => {
    queryMock.mockRejectedValue(Object.assign(new Error("connection lost"), { code: "08006" }));

    const response = await createAudit(auditRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
  });
});

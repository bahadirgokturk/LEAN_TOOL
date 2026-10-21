import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  user: { id: "owner", app_metadata: { access_approved: true } } as { id: string; app_metadata: object } | null,
  denyWrite: false,
  lookupError: false,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      getSession: async () => ({ data: { session: { user: state.user } } }),
    },
    from: () => {
      let id = "";
      let type = "";
      let values: Record<string, unknown> | undefined;
      const result = () => ({
        data: [...state.records.values()].filter(row => !type || row.record_type === type),
        error: null,
      });
      const query = {
        select: () => query,
        order: () => query,
        eq: (key: string, value: string) => {
          if (key === "id") id = value;
          if (key === "record_type") type = value;
          return query;
        },
        maybeSingle: async () => ({
          data: state.records.get(id) ?? null,
          error: state.lookupError ? { message: "lookup failed" } : null,
        }),
        insert: (row: Record<string, unknown>) => { id = String(row.id); values = row; return query; },
        update: (row: Record<string, unknown>) => { values = row; return query; },
        single: async () => {
          if (state.denyWrite) return { data: null, error: { message: "RLS denied" } };
          const row = { ...state.records.get(id), ...values };
          state.records.set(id, row);
          return { data: row, error: null };
        },
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  }),
}));

function request(id: string, title: string) {
  return new Request("http://localhost/api/lean-docs", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id, recordType: "operation_standard", documentNo: id, title,
      payload: { id, opName: title, isAdimlar: [{ adim: "Check", foto: "lean-media://photo.jpg" }] },
    }),
  });
}

describe("SOF persistence API", () => {
  beforeEach(() => {
    state.records.clear();
    state.user = { id: "owner", app_metadata: { access_approved: true } };
    state.denyWrite = false;
    state.lookupError = false;
  });

  it("returns compact saved photo references, lists multiple records, and preserves the other record on update", async () => {
    const first = await POST(request("one", "First"));
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      id: "one", payload: { isAdimlar: [{ foto: "/api/lean-docs/media?path=photo.jpg" }] },
    });
    expect((await POST(request("two", "Second"))).status).toBe(201);
    expect((await POST(request("one", "Revised"))).status).toBe(201);
    const response = await GET(new Request("http://localhost/api/lean-docs?type=operation_standard"));
    expect(await response.json()).toMatchObject([
      { id: "one", title: "Revised" }, { id: "two", title: "Second" },
    ]);
    expect(state.records.get("one")?.created_by).toBe("owner");
  });

  it("rejects unauthenticated saves", async () => {
    state.user = null;
    expect((await POST(request("one", "First"))).status).toBe(401);
    expect(state.records.size).toBe(0);
  });

  it("does not claim success when the database denies the write", async () => {
    state.denyWrite = true;
    expect((await POST(request("one", "First"))).status).toBe(403);
    expect(state.records.size).toBe(0);
  });

  it("does not insert when the existing-record lookup fails", async () => {
    state.lookupError = true;
    expect((await POST(request("one", "First"))).status).toBe(500);
    expect(state.records.size).toBe(0);
  });
});

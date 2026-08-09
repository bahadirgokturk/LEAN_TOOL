import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { enforceRateLimit } from "./rate-limit";

const config = { endpoint: "ai" as const, limit: 10, windowSeconds: 300 };

function clientWith(result: { data: boolean | null; error: null | { code: string } }) {
  return { rpc: vi.fn().mockResolvedValue(result) } as unknown as SupabaseClient;
}

describe("enforceRateLimit", () => {
  it("allows a request below the persistent user limit", async () => {
    expect(await enforceRateLimit(clientWith({ data: true, error: null }), config)).toBeNull();
  });

  it("returns 429 with retry guidance after the limit", async () => {
    const response = await enforceRateLimit(clientWith({ data: false, error: null }), config);

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("300");
  });

  it("fails closed when the persistent limiter is unavailable", async () => {
    const response = await enforceRateLimit(
      clientWith({ data: null, error: { code: "RPC_UNAVAILABLE" } }),
      config
    );

    expect(response?.status).toBe(503);
  });
});

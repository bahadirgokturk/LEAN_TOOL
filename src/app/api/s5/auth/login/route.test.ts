import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

describe("5S login session response", () => {
  beforeEach(() => {
    vi.stubEnv("S5_JWT_SECRET", "test-secret-that-is-long-enough-for-login-tests");
    vi.stubEnv("NODE_ENV", "production");
    queryMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the JWT only in a secure httpOnly cookie", async () => {
    const passwordHash = await bcrypt.hash("StrongPass123", 4);
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            username: "admin",
            name: "Administrator",
            role: "admin",
            password_hash: passwordHash,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const request = new NextRequest("http://localhost/api/s5/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "StrongPass123" }),
    });

    const response = await POST(request);
    const body = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("token");
    expect(cookie).toContain("s5_token=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
  });
});

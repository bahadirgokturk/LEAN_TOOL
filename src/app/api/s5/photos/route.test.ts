import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, type S5Role } from "@/lib/s5/auth";
import { createRoleTestUser, ROLE_TEST_SECRET } from "../role-test-helpers";
import { GET, POST } from "./route";

const fetchMock = vi.fn();

function imageFile(type = "image/png", bytes = [0x89, 0x50, 0x4e, 0x47, 0x00]): File {
  return new File([new Uint8Array(bytes)], "photo.png", { type });
}

async function invoke(role: S5Role, photo?: File): Promise<Response> {
  const form = new FormData();
  if (photo) form.set("photo", photo);
  const request = new NextRequest("http://localhost/api/s5/photos", {
    method: "POST",
    headers: { authorization: `Bearer ${signToken(createRoleTestUser(role))}` },
    body: form,
  });
  return POST(request, { params: Promise.resolve({}) });
}

describe("5S authenticated photo upload", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = ROLE_TEST_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-key";
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("allows an auditor to upload a verified image through the server", async () => {
    const response = await invoke("denetci", imageFile());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.url).toMatch(/^\/api\/s5\/photos\?path=/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer server-only-key",
      apikey: "server-only-key",
    });
  });

  it("rejects scoped viewer roles before contacting storage", async () => {
    expect((await invoke("departman", imageFile())).status).toBe(403);
    expect((await invoke("takimlider", imageFile())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types and forged image contents", async () => {
    expect((await invoke("admin", imageFile("text/html"))).status).toBe(415);
    expect((await invoke("admin", imageFile("image/png", [0x3c, 0x73, 0x76, 0x67]))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects files larger than three megabytes", async () => {
    const oversized = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.jpg", {
      type: "image/jpeg",
    });

    expect((await invoke("admin", oversized)).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the server-only credential is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect((await invoke("admin", imageFile())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a session to read a private photo", async () => {
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=2026-08-09/123e4567-e89b-12d3-a456-426614174000.jpg"
    );

    expect((await GET(request, { params: Promise.resolve({}) })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves a private photo through the authenticated application boundary", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    );
    const token = signToken(createRoleTestUser("departman"));
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=2026-08-09/123e4567-e89b-12d3-a456-426614174000.jpg",
      { headers: { authorization: `Bearer ${token}` } }
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/object/authenticated/s5-photos/");
  });

  it("serves legacy root-level audit photos after the bucket becomes private", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    );
    const token = signToken(createRoleTestUser("departman"));
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=1785486618123-a1b2c3d.jpg",
      { headers: { authorization: `Bearer ${token}` } }
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "/object/authenticated/s5-photos/1785486618123-a1b2c3d.jpg"
    );
  });

  it("rejects traversal paths while accepting legacy names", async () => {
    const token = signToken(createRoleTestUser("departman"));
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=../1785486618123-a1b2c3d.jpg",
      { headers: { authorization: `Bearer ${token}` } }
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

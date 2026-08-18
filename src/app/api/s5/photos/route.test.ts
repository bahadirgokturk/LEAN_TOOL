import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken, type S5Role } from "@/lib/s5/auth";
import { createRoleTestUser, ROLE_TEST_SECRET } from "../role-test-helpers";
import { GET, POST } from "./route";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
const fetchMock = vi.fn();

vi.mock("@/lib/s5/db", () => ({ query: queryMock }));

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
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: "authorized-audit" }], rowCount: 1 });
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
    expect(queryMock.mock.calls[0]?.[1]).toEqual([
      "2026-08-09/123e4567-e89b-12d3-a456-426614174000.jpg",
      "Plant A",
      "Assembly",
    ]);
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/object/authenticated/s5-photos/");
  });

  it("stores the uploader in the object path", async () => {
    const response = await invoke("denetci", imageFile());
    const { url } = await response.json();

    // `denetci-1` is the id createRoleTestUser assigns.
    expect(decodeURIComponent(url)).toMatch(/^\/api\/s5\/photos\?path=\d{4}-\d{2}-\d{2}\/denetci-1\//);
  });

  it("shows a just-uploaded photo before its audit exists", async () => {
    // The audit is still being filled in, so no row references this path yet.
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    );
    // Real ids are UUIDs, which is what the path pattern accepts.
    const uploader = { ...createRoleTestUser("denetci"), id: "9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f" };
    const request = new NextRequest(
      `http://localhost/api/s5/photos?path=2026-08-18/${uploader.id}/123e4567-e89b-12d3-a456-426614174000.jpg`,
      { headers: { authorization: `Bearer ${signToken(uploader)}` } }
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    // Own upload: proven by the path, so no database lookup is needed.
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("still hides another user's upload that no visible audit references", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=2026-08-18/11111111-2222-3333-4444-555555555555/123e4567-e89b-12d3-a456-426614174000.jpg",
      { headers: { authorization: `Bearer ${signToken(createRoleTestUser("denetci"))}` } }
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(404);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("hides a photo that is not attached to an audit visible to the caller", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    const token = signToken(createRoleTestUser("departman"));
    const request = new NextRequest(
      "http://localhost/api/s5/photos?path=2026-08-09/123e4567-e89b-12d3-a456-426614174000.jpg",
      { headers: { authorization: `Bearer ${token}` } }
    );

    expect((await GET(request, { params: Promise.resolve({}) })).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
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

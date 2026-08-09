import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  requireRole,
  requireScope,
  requireUser,
  signToken,
  type S5User,
} from "./auth";
import { HttpError } from "./http";

const TEST_SECRET = "test-secret-that-is-long-enough-for-local-tests";

const departmentUser: S5User = {
  id: "user-1",
  username: "quality.lead",
  name: "Quality Lead",
  role: "departman",
  plant: "Plant A",
  department: "Assembly",
  section: "Line 1",
};

function createRequest(token?: string): NextRequest {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  return new NextRequest("http://localhost/api/s5/me", { headers });
}

describe("5S authorization", () => {
  beforeEach(() => {
    process.env.S5_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.S5_JWT_SECRET;
  });

  it("accepts a valid signed session", () => {
    const token = signToken(departmentUser);

    expect(requireUser(createRequest(token))).toEqual(departmentUser);
  });

  it("maps legacy Turkish token claims to English application fields", () => {
    const token = jwt.sign(
      {
        id: "legacy-1",
        username: "legacy.user",
        name: "Legacy User",
        role: "departman",
        fabrika: "Plant B",
        dept: "Paint",
        bolum: "Booth 2",
      },
      TEST_SECRET,
      { algorithm: "HS256" }
    );

    expect(requireUser(createRequest(token))).toMatchObject({
      plant: "Plant B",
      department: "Paint",
      section: "Booth 2",
    });
  });

  it("rejects requests without a session", () => {
    expect(() => requireUser(createRequest())).toThrowError(HttpError);
    expect(() => requireUser(createRequest())).toThrowError("Oturum gerekli");
  });

  it("rejects tokens with an unknown role", () => {
    const token = jwt.sign({ ...departmentUser, role: "superuser" }, TEST_SECRET, {
      algorithm: "HS256",
    });

    expect(() => requireUser(createRequest(token))).toThrowError(HttpError);
  });

  it("denies operations outside the user's role", () => {
    expect(() => requireRole(departmentUser, "admin")).toThrowError(HttpError);
  });

  it("fails closed when a scoped user has no plant assignment", () => {
    expect(() => requireScope({ ...departmentUser, plant: "" })).toThrowError(HttpError);
  });

  it("returns the assigned plant and department for a scoped user", () => {
    expect(requireScope(departmentUser)).toEqual({
      plant: "Plant A",
      department: "Assembly",
    });
  });
});

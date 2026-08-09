import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

/**
 * Shared HTTP plumbing for the 5S API.
 *
 * Every route handler used to repeat the same auth guard, try/catch and error
 * shape. That is centralised here so a route cannot ship without its guard, and
 * so error mapping (unique violation, foreign key, unexpected) lives in exactly
 * one place.
 */

/** An error whose message is safe to show the user. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_INVALID_TEXT_REPRESENTATION = "22P02";

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

/**
 * Maps a thrown value onto a response.
 *
 * Internal error text is never sent to the client — a raw Postgres message
 * would disclose table and column names. Unexpected errors are logged in full
 * server-side and answered with a generic message.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  switch (postgresErrorCode(error)) {
    case PG_UNIQUE_VIOLATION:
      return NextResponse.json({ error: "Bu kayıt zaten mevcut." }, { status: 409 });
    case PG_FOREIGN_KEY_VIOLATION:
      return NextResponse.json(
        { error: "Bu kayda bağlı başka kayıtlar var, önce onları silin." },
        { status: 409 }
      );
    case PG_INVALID_TEXT_REPRESENTATION:
      return NextResponse.json({ error: "Geçersiz parametre." }, { status: 400 });
  }

  console.error("[s5] unhandled error:", error);
  return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
}

/** Parses and validates a JSON request body, answering 400 on malformed input. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Geçersiz istek gövdesi.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue?.path.join(".");
    throw new HttpError(400, field ? `Geçersiz alan: ${field}` : "Geçersiz istek.");
  }
  return result.data;
}

/** Reads a bounded positive integer from the query string. */
export function readIntParam(
  params: URLSearchParams,
  name: string,
  { fallback, min, max }: { fallback: number; min: number; max: number }
): number {
  const raw = params.get(name);
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** Reads the shared bounded pagination contract used by 5S list endpoints. */
export function readPaginationParams(params: URLSearchParams): { limit: number; offset: number } {
  return {
    limit: readIntParam(params, "limit", { fallback: 200, min: 1, max: 500 }),
    offset: readIntParam(params, "offset", { fallback: 0, min: 0, max: 1_000_000 }),
  };
}

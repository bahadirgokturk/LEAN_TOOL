import { Pool, type QueryResultRow } from "pg";

/**
 * Postgres access for the 5S module (Supabase transaction pooler, port 6543).
 *
 * The pool is cached on `globalThis` so Next.js hot reloads in development do
 * not leak a new pool on every recompile. In serverless production each
 * instance keeps its own small pool, hence the low `max`.
 */
const globalForPg = globalThis as unknown as { s5Pool?: Pool };

function getPool(): Pool {
  if (!globalForPg.s5Pool) {
    const connectionString = process.env.S5_DATABASE_URL;
    if (!connectionString) {
      throw new Error("S5_DATABASE_URL is not set — add the Supabase pooler connection string.");
    }
    globalForPg.s5Pool = new Pool({
      connectionString,
      // Supabase's pooler presents a certificate this client cannot chain to a
      // local CA. Verification is disabled for the pooler host only; traffic is
      // still TLS-encrypted.
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      // Prevents a single slow query from occupying a pooled connection forever.
      statement_timeout: 15_000,
    });
  }
  return globalForPg.s5Pool;
}

/** Runs a parameterised SQL statement. Never interpolate user input into `text`. */
export function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  return getPool().query<T>(text, params);
}

/** Postgres: column referenced by a statement does not exist on the table. */
const PG_UNDEFINED_COLUMN = "42703";

/**
 * True when a query failed only because a column is missing from the table.
 *
 * The 5S schema is migrated by running the files in `supabase/` by hand, so a
 * deploy can reach production before its migration does. When the missing
 * column is non-essential, callers retry without it rather than answering 500 —
 * losing an audit that was just filled in is far worse than losing one metadata
 * column. See `GET /api/s5/health/schema`, which reports the gap to the admin.
 */
export function isUndefinedColumnError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === PG_UNDEFINED_COLUMN
  );
}

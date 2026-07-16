import { Pool, type QueryResultRow } from "pg";

// 5S modülü — Supabase Postgres bağlantısı (transaction pooler, port 6543).
// Serverless'ta her instance küçük bir pool tutar; global cache dev hot-reload'da
// bağlantı sızıntısını önler.
const globalForPg = globalThis as unknown as { s5Pool?: Pool };

function getPool(): Pool {
  if (!globalForPg.s5Pool) {
    const connectionString = process.env.S5_DATABASE_URL;
    if (!connectionString) {
      throw new Error("S5_DATABASE_URL tanımlı değil — Supabase pooler bağlantı adresini env'e ekleyin.");
    }
    globalForPg.s5Pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForPg.s5Pool;
}

export function q<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  return getPool().query<T>(text, params);
}

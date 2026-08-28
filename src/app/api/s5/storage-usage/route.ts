import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { protectedRoute } from "@/lib/s5/route";
import { createStorageUsage } from "@/lib/s5/storage-usage";

type UsageRow = {
  used_bytes: string;
  photo_count: number;
  audit_count: number;
};

/** Real 5S photo usage for the history-screen capacity indicator. */
export const GET = protectedRoute({ roles: ["admin"] }, async () => {
  const { rows } = await query<UsageRow>(`
    SELECT
      COALESCE((
        SELECT SUM(COALESCE((metadata->>'size')::bigint, 0))
          FROM storage.objects
         WHERE bucket_id = 's5-photos'
      ), 0)::text AS used_bytes,
      (SELECT COUNT(*)::int FROM storage.objects WHERE bucket_id = 's5-photos') AS photo_count,
      (SELECT COUNT(*)::int FROM public.s5_audits) AS audit_count
  `);

  const row = rows[0];
  return NextResponse.json(createStorageUsage(row.used_bytes, row.photo_count, row.audit_count), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
});

import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { updateAreaSchema } from "@/lib/s5/schemas";

export const GET = protectedRoute<{ id: string }>({}, async ({ params }) => {
  const { rows } = await query("SELECT * FROM s5_areas WHERE id = $1", [params.id]);
  if (!rows[0]) throw new HttpError(404, "Bölge bulunamadı");
  return NextResponse.json(rows[0]);
});

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin"] },
  async ({ req, params }) => {
    const patch = await parseBody(req, updateAreaSchema);

    const { rows: existingRows } = await query("SELECT * FROM s5_areas WHERE id = $1", [params.id]);
    const existing = existingRows[0];
    if (!existing) throw new HttpError(404, "Bölge bulunamadı");

    // Merge semantics — omitting a field must not blank it.
    const { rows } = await query(
      `UPDATE s5_areas SET name=$1, dept=$2, alt_dept=$3, fabrika=$4, description=$5
        WHERE id=$6 RETURNING *`,
      [
        patch.name !== undefined ? stripAngleBrackets(patch.name, 128) : existing.name,
        patch.dept !== undefined ? stripAngleBrackets(patch.dept, 128) : existing.dept,
        patch.alt_dept !== undefined
          ? stripAngleBrackets(patch.alt_dept, 128)
          : existing.alt_dept,
        patch.fabrika !== undefined
          ? stripAngleBrackets(patch.fabrika, 128)
          : existing.fabrika,
        patch.description !== undefined
          ? stripAngleBrackets(patch.description, 2000)
          : existing.description,
        params.id,
      ]
    );
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query("DELETE FROM s5_areas WHERE id=$1", [params.id]);
  if (!rowCount) throw new HttpError(404, "Bölge bulunamadı");
  return NextResponse.json({ ok: true });
});

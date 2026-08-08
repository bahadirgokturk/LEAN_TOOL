import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets, stripAngleBracketsDeep } from "@/lib/s5/auth";
import { HttpError, parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { formTemplateSchema } from "@/lib/s5/schemas";

export const PUT = protectedRoute<{ id: string }>(
  { roles: ["admin"] },
  async ({ req, params }) => {
    const body = await parseBody(req, formTemplateSchema);

    const { rows } = await query(
      `UPDATE s5_form_templates SET adi=$1, aciklama=$2, pillarlar=$3, updated_at=NOW()
        WHERE id=$4 RETURNING *`,
      [
        stripAngleBrackets(body.adi, 128),
        stripAngleBrackets(body.aciklama, 2000),
        JSON.stringify(stripAngleBracketsDeep(body.pillarlar ?? [])),
        params.id,
      ]
    );
    if (!rows[0]) throw new HttpError(404, "Şablon bulunamadı");
    return NextResponse.json(rows[0]);
  }
);

export const DELETE = protectedRoute<{ id: string }>({ roles: ["admin"] }, async ({ params }) => {
  const { rowCount } = await query("DELETE FROM s5_form_templates WHERE id=$1", [params.id]);
  if (!rowCount) throw new HttpError(404, "Şablon bulunamadı");
  return NextResponse.json({ ok: true });
});

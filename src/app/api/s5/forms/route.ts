import { NextResponse } from "next/server";
import { isUndefinedColumnError, query } from "@/lib/s5/db";
import { stripAngleBrackets, stripAngleBracketsDeep } from "@/lib/s5/auth";
import { parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { formTemplateSchema } from "@/lib/s5/schemas";

// `adi`, `aciklama` and `pillarlar` are Turkish column names inherited from the
// original system; renaming them would require a data migration.
export const GET = protectedRoute({}, async () => {
  const { rows } = await query("SELECT * FROM s5_form_templates ORDER BY created_at ASC");
  return NextResponse.json(rows);
});

export const POST = protectedRoute({ roles: ["admin"] }, async ({ req, user }) => {
  const body = await parseBody(req, formTemplateSchema);

  const values = [
    stripAngleBrackets(body.adi, 128),
    stripAngleBrackets(body.aciklama, 2000),
    JSON.stringify(stripAngleBracketsDeep(body.pillarlar ?? [])),
    user.id,
    body.form_tipi ?? null,
  ];

  // `form_tipi` may not be migrated yet — the template itself must still save.
  try {
    const { rows } = await query(
      `INSERT INTO s5_form_templates (adi, aciklama, pillarlar, created_by, form_tipi)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      values
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    if (!isUndefinedColumnError(error)) throw error;
    console.warn("[s5] s5_form_templates.form_tipi is missing — run supabase/s5-form-tipi.sql");
    const { rows } = await query(
      `INSERT INTO s5_form_templates (adi, aciklama, pillarlar, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      values.slice(0, 4)
    );
    return NextResponse.json(rows[0], { status: 201 });
  }
});

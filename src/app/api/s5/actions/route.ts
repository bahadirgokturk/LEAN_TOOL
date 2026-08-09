import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets } from "@/lib/s5/auth";
import { parseBody, readPaginationParams } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { createActionSchema } from "@/lib/s5/schemas";
import { applyActionVisibility, createConditions } from "@/lib/s5/sql";

export const GET = protectedRoute({}, async ({ req, user }) => {
  const searchParams = req.nextUrl.searchParams;
  const conditions = createConditions();

  applyActionVisibility(conditions, user);

  const status = searchParams.get("status");
  if (status) conditions.add((p) => `ac.status = ${p}`, status);

  const { limit, offset } = readPaginationParams(searchParams);

  const whereClause = conditions.whereClause;
  const limitPlaceholder = conditions.bind(limit);
  const offsetPlaceholder = conditions.bind(offset);

  const { rows } = await query(
    `SELECT ac.*, ar.fabrika AS area_fabrika, ar.dept AS area_dept
       FROM s5_actions ac
       LEFT JOIN s5_areas ar ON ar.id = ac.area_id
       ${whereClause}
      ORDER BY ac.created_at DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    conditions.values
  );
  return NextResponse.json(rows);
});

export const POST = protectedRoute({ roles: ["admin", "denetci"] }, async ({ req }) => {
  const body = await parseBody(req, createActionSchema);

  const { rows } = await query(
    `INSERT INTO s5_actions (audit_id, area_id, area_name, description, assigned_to, due_date, status, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      body.audit_id ?? null,
      body.area_id ?? null,
      stripAngleBrackets(body.area_name, 128),
      stripAngleBrackets(body.description, 2000),
      stripAngleBrackets(body.assigned_to, 128),
      body.due_date ?? null,
      body.status ?? "Açık",
      body.priority ?? "Orta",
    ]
  );
  return NextResponse.json(rows[0], { status: 201 });
});

import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { isScopedRole, requireScope, stripAngleBrackets } from "@/lib/s5/auth";
import { parseBody } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { createAreaSchema } from "@/lib/s5/schemas";
import { createConditions } from "@/lib/s5/sql";

export const GET = protectedRoute({}, async ({ user }) => {
  const conditions = createConditions();

  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    conditions.add((p) => `fabrika = ${p}`, scope.plant);
    if (scope.department) conditions.add((p) => `dept = ${p}`, scope.department);
  }

  const { rows } = await query(
    `SELECT * FROM s5_areas ${conditions.whereClause}
      ORDER BY fabrika, dept, alt_dept, name`,
    conditions.values
  );
  return NextResponse.json(rows);
});

export const POST = protectedRoute({ roles: ["admin"] }, async ({ req }) => {
  const body = await parseBody(req, createAreaSchema);

  const { rows } = await query(
    `INSERT INTO s5_areas (id, name, dept, alt_dept, fabrika, description)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      body.id,
      stripAngleBrackets(body.name, 128),
      stripAngleBrackets(body.dept, 128),
      stripAngleBrackets(body.alt_dept, 128),
      stripAngleBrackets(body.fabrika, 128),
      stripAngleBrackets(body.description, 2000),
    ]
  );
  return NextResponse.json(rows[0], { status: 201 });
});

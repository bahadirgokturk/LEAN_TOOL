import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { stripAngleBrackets, stripAngleBracketsDeep } from "@/lib/s5/auth";
import { HttpError, parseBody, readPaginationParams } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";
import { createAuditSchema } from "@/lib/s5/schemas";
import { AUDIT_BASE_SELECT, applyAuditVisibility, createConditions } from "@/lib/s5/sql";

/** Rejects oversized payloads before they reach the database. */
const MAX_JSON_FIELD_BYTES = 512_000;

export const GET = protectedRoute({}, async ({ req, user }) => {
  const searchParams = req.nextUrl.searchParams;
  const conditions = createConditions();

  applyAuditVisibility(conditions, user);

  const plant = searchParams.get("fabrika");
  const department = searchParams.get("dept");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (plant) conditions.add((p) => `ar.fabrika = ${p}`, plant);
  if (department) conditions.add((p) => `ar.dept = ${p}`, department);
  if (status) conditions.add((p) => `a.status = ${p}`, status);
  if (from) conditions.add((p) => `a.date >= ${p}`, from);
  if (to) conditions.add((p) => `a.date <= ${p}`, to);

  const { limit, offset } = readPaginationParams(searchParams);

  const whereClause = conditions.whereClause;
  const limitPlaceholder = conditions.bind(limit);
  const offsetPlaceholder = conditions.bind(offset);

  const { rows } = await query(
    `${AUDIT_BASE_SELECT} ${whereClause}
     ORDER BY a.date DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    conditions.values
  );
  return NextResponse.json(rows);
});

export const POST = protectedRoute({ roles: ["admin", "denetci"] }, async ({ req, user }) => {
  const body = await parseBody(req, createAuditSchema);

  const pillars = stripAngleBracketsDeep(body.pillars_json ?? {});
  const answers = stripAngleBracketsDeep(body.answers_json ?? {});
  const notes = stripAngleBracketsDeep(body.notes_json ?? {});
  const photos = body.photos_json ?? {};

  assertJsonWithinLimit({ answers, notes, photos });

  const { rows } = await query(
    `INSERT INTO s5_audits
       (area_id, area_name, auditor_id, auditor_name, date, shift, total_score,
        pillars_json, answers_json, notes_json, photos_json, status, form_code, location, team_leader,
        form_template_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      body.area_id,
      stripAngleBrackets(body.area_name, 128),
      user.id,
      user.name,
      body.date,
      stripAngleBrackets(body.shift, 16),
      body.total_score ?? 0,
      JSON.stringify(pillars),
      JSON.stringify(answers),
      JSON.stringify(notes),
      JSON.stringify(photos),
      body.status ?? "tamamlandi",
      stripAngleBrackets(body.form_code, 64),
      stripAngleBrackets(body.location, 128),
      stripAngleBrackets(body.team_leader, 128),
      body.form_template_id ?? null,
    ]
  );

  const audit = rows[0];
  await closeMatchingPlan(audit.id, user.id, body.area_id);
  return NextResponse.json(audit, { status: 201 });
});

function assertJsonWithinLimit(fields: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(fields)) {
    if (JSON.stringify(value).length > MAX_JSON_FIELD_BYTES) {
      throw new HttpError(413, `Denetim verisi çok büyük (${name}). Fotoğraf sayısını azaltın.`);
    }
  }
}

/**
 * Marks the auditor's oldest open assignment for this area as completed.
 *
 * Doing it here rather than in the client means it works regardless of how the
 * audit was started — the form-type QR codes do not carry a plan id.
 * A failure here must not lose the audit that was just saved, so it is logged
 * rather than propagated.
 */
async function closeMatchingPlan(auditId: string, auditorId: string, areaId: string) {
  try {
    await query(
      `UPDATE s5_audit_plans
          SET status = 'Tamamlandı', completed_audit_id = $1
        WHERE id = (
          SELECT id FROM s5_audit_plans
           WHERE auditor_id = $2 AND area_id = $3
             AND status IN ('Bekliyor','Devam Ediyor')
           ORDER BY planned_date ASC
           LIMIT 1
        )`,
      [auditId, auditorId, areaId]
    );
  } catch (error) {
    console.warn("[s5] could not auto-close the matching audit plan", error);
  }
}

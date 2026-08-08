import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { isScopedRole, requireScope } from "@/lib/s5/auth";
import { protectedRoute } from "@/lib/s5/route";
import { applyAuditVisibility, createConditions } from "@/lib/s5/sql";

/**
 * Dashboard aggregates.
 *
 * Every query here is scoped by the caller's role — including the per-area
 * breakdown, which previously returned every plant's scores to every user.
 */
export const GET = protectedRoute({}, async ({ req, user }) => {
  const searchParams = req.nextUrl.searchParams;
  const conditions = createConditions();

  applyAuditVisibility(conditions, user);

  const plant = searchParams.get("fabrika");
  const department = searchParams.get("dept");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (plant) conditions.add((p) => `ar.fabrika = ${p}`, plant);
  if (department) conditions.add((p) => `ar.dept = ${p}`, department);
  if (from) conditions.add((p) => `a.date >= ${p}`, from);
  if (to) conditions.add((p) => `a.date <= ${p}`, to);

  const whereClause = conditions.whereClause;
  const values = conditions.values;

  // The per-area breakdown is scoped on the area row itself so that areas with
  // no audits are still listed for the roles allowed to see them.
  const areaScope = createConditions();
  if (isScopedRole(user.role)) {
    const scope = requireScope(user);
    areaScope.add((p) => `ar.fabrika = ${p}`, scope.plant);
    if (scope.department) areaScope.add((p) => `ar.dept = ${p}`, scope.department);
  }
  if (plant) areaScope.add((p) => `ar.fabrika = ${p}`, plant);
  if (department) areaScope.add((p) => `ar.dept = ${p}`, department);

  // Open actions use their own predicate set because the table differs.
  const actionConditions = createConditions();
  actionConditions.add((p) => `ac.status = ${p}`, "Açık");
  if (user.role === "denetci") {
    actionConditions.add(
      (p) => `EXISTS (SELECT 1 FROM s5_audits a WHERE a.id = ac.audit_id AND a.auditor_id = ${p})`,
      user.id
    );
  } else if (user.plant) {
    actionConditions.add((p) => `ar.fabrika = ${p}`, user.plant);
  }

  // Independent queries — run them concurrently rather than in series.
  const [summary, openActions, bestArea, areaBreakdown, monthlyTrend] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS total_audits,
         COALESCE(ROUND(AVG(a.total_score)::numeric, 1), 0) AS avg_score,
         COALESCE(MAX(a.total_score), 0) AS max_score,
         COALESCE(MIN(a.total_score), 0) AS min_score
       FROM s5_audits a
       LEFT JOIN s5_areas ar ON ar.id = a.area_id
       ${whereClause}`,
      values
    ),
    query(
      `SELECT COUNT(*)::int AS open_actions
         FROM s5_actions ac
         LEFT JOIN s5_areas ar ON ar.id = ac.area_id
         ${actionConditions.whereClause}`,
      actionConditions.values
    ),
    query(
      `SELECT ar.name AS area_name, ROUND(AVG(a.total_score)::numeric, 1) AS avg_score
         FROM s5_audits a
         LEFT JOIN s5_areas ar ON ar.id = a.area_id
         ${whereClause}
        GROUP BY ar.name ORDER BY avg_score DESC LIMIT 1`,
      values
    ),
    // Areas first, so a never-audited area still appears with a zero count —
    // the dashboard relies on that to flag areas that are overdue for an audit.
    // Visibility is enforced on the area itself rather than on the audit join.
    query(
      `SELECT ar.id, ar.name, ar.dept, ar.alt_dept, ar.fabrika,
              COUNT(a.id)::int AS audit_count,
              ROUND(AVG(a.total_score)::numeric, 1) AS avg_score,
              MAX(a.date) AS last_audit_date
         FROM s5_areas ar
         LEFT JOIN s5_audits a ON a.area_id = ar.id
         ${areaScope.whereClause}
        GROUP BY ar.id, ar.name, ar.dept, ar.alt_dept, ar.fabrika
        ORDER BY ar.fabrika, ar.dept, ar.name`,
      areaScope.values
    ),
    query(
      `SELECT TO_CHAR(a.date, 'YYYY-MM') AS month,
              ROUND(AVG(a.total_score)::numeric, 1) AS avg_score,
              COUNT(*)::int AS count
         FROM s5_audits a
         LEFT JOIN s5_areas ar ON ar.id = a.area_id
         ${whereClause}
        GROUP BY month ORDER BY month DESC LIMIT 6`,
      values
    ),
  ]);

  return NextResponse.json({
    stats: summary.rows[0],
    actions: openActions.rows[0],
    best: bestArea.rows[0] ?? null,
    areas: areaBreakdown.rows,
    trend: monthlyTrend.rows.reverse(),
  });
});

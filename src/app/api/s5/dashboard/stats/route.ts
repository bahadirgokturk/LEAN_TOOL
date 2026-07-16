import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, errorResponse } from "@/lib/s5/auth";

// GET /api/s5/dashboard/stats — Dashboard istatistikleri (rol bazlı)
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const sp = req.nextUrl.searchParams;
    const fabrika = sp.get("fabrika");
    const dept = sp.get("dept");
    const from = sp.get("from");
    const to = sp.get("to");

    const params: unknown[] = [];
    const where: string[] = [];
    let pidx = 1;

    if (user.role === "denetci") {
      where.push(`a.auditor_id = $${pidx++}`);
      params.push(user.id);
    } else if (user.role === "departman" || user.role === "takimlider") {
      where.push(`ar.fabrika = $${pidx++}`);
      params.push(user.fabrika);
    }

    if (fabrika) { where.push(`ar.fabrika = $${pidx++}`); params.push(fabrika); }
    if (dept)    { where.push(`ar.dept = $${pidx++}`);    params.push(dept); }
    if (from)    { where.push(`a.date >= $${pidx++}`);    params.push(from); }
    if (to)      { where.push(`a.date <= $${pidx++}`);    params.push(to); }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const statsQ = await q(`
      SELECT
        COUNT(*)::int AS total_audits,
        COALESCE(ROUND(AVG(a.total_score)::numeric, 1), 0) AS avg_score,
        COALESCE(MAX(a.total_score), 0) AS max_score,
        COALESCE(MIN(a.total_score), 0) AS min_score
      FROM s5_audits a
      LEFT JOIN s5_areas ar ON ar.id = a.area_id
      ${whereClause}
    `, params);

    const actParams: unknown[] = [];
    const actWhere = ["ac.status = 'Açık'"];
    if (user.role === "departman") {
      actParams.push(user.fabrika);
      actWhere.push(`ar.fabrika = $${actParams.length}`);
    }
    if (user.role === "denetci") {
      actParams.push(user.id);
      actWhere.push(
        `EXISTS (SELECT 1 FROM s5_audits a WHERE a.id=ac.audit_id AND a.auditor_id=$${actParams.length})`
      );
    }
    const actionsQ = await q(`
      SELECT COUNT(*)::int AS open_actions
      FROM s5_actions ac
      LEFT JOIN s5_areas ar ON ar.id = ac.area_id
      WHERE ${actWhere.join(" AND ")}
    `, actParams);

    const bestQ = await q(`
      SELECT ar.name AS area_name, ROUND(AVG(a.total_score)::numeric, 1) AS avg_score
      FROM s5_audits a
      LEFT JOIN s5_areas ar ON ar.id = a.area_id
      ${whereClause}
      GROUP BY ar.name ORDER BY avg_score DESC LIMIT 1
    `, params);

    const areaStatsQ = await q(`
      SELECT ar.id, ar.name, ar.dept, ar.alt_dept, ar.fabrika,
             COUNT(a.id)::int AS audit_count,
             ROUND(AVG(a.total_score)::numeric, 1) AS avg_score,
             MAX(a.date) AS last_audit_date
      FROM s5_areas ar
      LEFT JOIN s5_audits a ON a.area_id = ar.id
      GROUP BY ar.id, ar.name, ar.dept, ar.alt_dept, ar.fabrika
      ORDER BY ar.fabrika, ar.dept, ar.name
    `);

    const trendQ = await q(`
      SELECT
        TO_CHAR(a.date, 'YYYY-MM') AS month,
        ROUND(AVG(a.total_score)::numeric, 1) AS avg_score,
        COUNT(*)::int AS count
      FROM s5_audits a
      LEFT JOIN s5_areas ar ON ar.id = a.area_id
      ${whereClause}
      GROUP BY month ORDER BY month DESC LIMIT 6
    `, params);

    return NextResponse.json({
      stats: statsQ.rows[0],
      actions: actionsQ.rows[0],
      best: bestQ.rows[0] || null,
      areas: areaStatsQ.rows,
      trend: trendQ.rows.reverse(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

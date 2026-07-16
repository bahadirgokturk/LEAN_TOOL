import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse } from "@/lib/s5/auth";

const BASE_SELECT = `
  SELECT a.*, ar.name AS area_name_db, ar.dept, ar.alt_dept, ar.fabrika AS area_fabrika
  FROM s5_audits a
  LEFT JOIN s5_areas ar ON ar.id = a.area_id
`;

// GET /api/s5/audits — Role'e göre filtreli denetim listesi
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    const sp = req.nextUrl.searchParams;
    const fabrika = sp.get("fabrika");
    const dept = sp.get("dept");
    const from = sp.get("from");
    const to = sp.get("to");
    const status = sp.get("status");
    const limit = sp.get("limit") ?? "200";
    const offset = sp.get("offset") ?? "0";

    const params: unknown[] = [];
    const where: string[] = [];
    let pidx = 1;

    // Rol bazlı kısıtlama
    if (user.role === "denetci") {
      where.push(`a.auditor_id = $${pidx++}`);
      params.push(user.id);
    } else if (user.role === "departman" || user.role === "takimlider") {
      if (user.fabrika) {
        where.push(`ar.fabrika = $${pidx++}`);
        params.push(user.fabrika);
      }
      if (user.dept) {
        where.push(`ar.dept = $${pidx++}`);
        params.push(user.dept);
      }
    }

    if (fabrika) { where.push(`ar.fabrika = $${pidx++}`); params.push(fabrika); }
    if (dept)    { where.push(`ar.dept = $${pidx++}`);    params.push(dept); }
    if (status)  { where.push(`a.status = $${pidx++}`);   params.push(status); }
    if (from)    { where.push(`a.date >= $${pidx++}`);    params.push(from); }
    if (to)      { where.push(`a.date <= $${pidx++}`);    params.push(to); }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
    const sql = `${BASE_SELECT} ${whereClause} ORDER BY a.date DESC LIMIT $${pidx++} OFFSET $${pidx}`;
    params.push(Number(limit), Number(offset));

    const { rows } = await q(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/s5/audits — Yeni denetim kaydet (admin + denetci)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin", "denetci");

    const body = await req.json();
    const {
      area_id, area_name, date, shift, total_score,
      pillars_json, answers_json, notes_json, photos_json,
      status, form_code, location, team_leader,
    } = body;

    if (!area_id || !date) {
      return NextResponse.json({ error: "area_id ve date zorunlu" }, { status: 400 });
    }

    const { rows } = await q(
      `INSERT INTO s5_audits
         (area_id, area_name, auditor_id, auditor_name, date, shift, total_score,
          pillars_json, answers_json, notes_json, photos_json, status, form_code, location, team_leader)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        area_id, area_name || "", user.id, user.name,
        date, shift || "", total_score || 0,
        JSON.stringify(pillars_json || {}),
        JSON.stringify(answers_json || {}),
        JSON.stringify(notes_json || {}),
        JSON.stringify(photos_json || {}),
        status || "tamamlandi",
        form_code || "", location || "", team_leader || "",
      ]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

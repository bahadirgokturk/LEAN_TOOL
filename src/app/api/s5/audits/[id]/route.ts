import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse } from "@/lib/s5/auth";

const BASE_SELECT = `
  SELECT a.*, ar.name AS area_name_db, ar.dept, ar.alt_dept, ar.fabrika AS area_fabrika
  FROM s5_audits a
  LEFT JOIN s5_areas ar ON ar.id = a.area_id
`;

type Ctx = { params: Promise<{ id: string }> };

// GET /api/s5/audits/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    const { id } = await ctx.params;

    const { rows } = await q(`${BASE_SELECT} WHERE a.id = $1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: "Denetim bulunamadı" }, { status: 404 });

    const audit = rows[0];
    if (user.role === "departman" && audit.area_fabrika !== user.fabrika) {
      return NextResponse.json({ error: "Bu denetime erişim yetkiniz yok" }, { status: 403 });
    }
    if (user.role === "denetci" && audit.auditor_id !== user.id) {
      return NextResponse.json({ error: "Bu denetime erişim yetkiniz yok" }, { status: 403 });
    }
    return NextResponse.json(audit);
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/s5/audits/:id — Denetim güncelle
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin", "denetci");
    const { id } = await ctx.params;

    const { rows: existing } = await q("SELECT * FROM s5_audits WHERE id=$1", [id]);
    if (!existing[0]) return NextResponse.json({ error: "Denetim bulunamadı" }, { status: 404 });

    if (user.role === "denetci" && existing[0].auditor_id !== user.id) {
      return NextResponse.json({ error: "Bu denetime erişim yetkiniz yok" }, { status: 403 });
    }

    const body = await req.json();
    const {
      area_id, area_name, date, shift, total_score,
      pillars_json, answers_json, notes_json, photos_json,
      status, form_code, location, team_leader,
    } = body;

    const { rows } = await q(
      `UPDATE s5_audits SET
         area_id=$1, area_name=$2, date=$3, shift=$4, total_score=$5,
         pillars_json=$6, answers_json=$7, notes_json=$8, photos_json=$9,
         status=$10, form_code=$11, location=$12, team_leader=$13
       WHERE id=$14 RETURNING *`,
      [
        area_id || existing[0].area_id,
        area_name || existing[0].area_name,
        date || existing[0].date,
        shift !== undefined ? shift : existing[0].shift,
        total_score !== undefined ? total_score : existing[0].total_score,
        JSON.stringify(pillars_json || existing[0].pillars_json),
        JSON.stringify(answers_json || existing[0].answers_json),
        JSON.stringify(notes_json || existing[0].notes_json),
        JSON.stringify(photos_json || existing[0].photos_json),
        status || existing[0].status,
        form_code || existing[0].form_code,
        location || existing[0].location,
        team_leader || existing[0].team_leader,
        id,
      ]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/s5/audits/:id — Sadece admin
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin");
    const { id } = await ctx.params;

    const { rowCount } = await q("DELETE FROM s5_audits WHERE id=$1", [id]);
    if (!rowCount) return NextResponse.json({ error: "Denetim bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

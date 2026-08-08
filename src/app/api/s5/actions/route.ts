import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/s5/db";
import { requireUser, requireRole, errorResponse, sanitizeText } from "@/lib/s5/auth";

// GET /api/s5/actions — Rol bazlı aksiyon listesi
export async function GET(req: NextRequest) {
  try {
    const user = requireUser(req);
    let sql = `
      SELECT ac.*, ar.fabrika AS area_fabrika, ar.dept AS area_dept
      FROM s5_actions ac
      LEFT JOIN s5_areas ar ON ar.id = ac.area_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (user.role === "departman" || user.role === "takimlider") {
      if (user.fabrika) {
        sql += ` AND ar.fabrika = $${params.length + 1}`;
        params.push(user.fabrika);
      }
      if (user.dept) {
        sql += ` AND ar.dept = $${params.length + 1}`;
        params.push(user.dept);
      }
    } else if (user.role === "denetci") {
      sql += ` AND EXISTS (
        SELECT 1 FROM s5_audits a WHERE a.id = ac.audit_id AND a.auditor_id = $${params.length + 1}
      )`;
      params.push(user.id);
    }

    const status = req.nextUrl.searchParams.get("status");
    if (status) {
      sql += ` AND ac.status = $${params.length + 1}`;
      params.push(status);
    }

    sql += " ORDER BY ac.created_at DESC LIMIT 500";
    const { rows } = await q(sql, params);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/s5/actions — Yeni aksiyon (admin + denetci)
export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    requireRole(user, "admin", "denetci");

    const { audit_id, area_id, area_name, description, assigned_to, due_date, status, priority } =
      await req.json();
    if (!description) return NextResponse.json({ error: "description zorunlu" }, { status: 400 });

    const { rows } = await q(
      `INSERT INTO s5_actions (audit_id, area_id, area_name, description, assigned_to, due_date, status, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [audit_id || null, area_id || null, sanitizeText(area_name,128),
       sanitizeText(description,2000), sanitizeText(assigned_to,128), due_date || null,
       status || "Açık", priority || "Orta"]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { HttpError } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";

/**
 * Marks a form template as the single active audit form.
 *
 * At most one template may be active (enforced by a partial unique index), so
 * the previous active one is cleared first. The sentinel id "default" clears the
 * selection entirely, falling back to the built-in 5S form.
 */
export const POST = protectedRoute<{ id: string }>(
  { roles: ["admin"] },
  async ({ params }) => {
    await query("UPDATE s5_form_templates SET aktif = false WHERE aktif = true");

    if (params.id === "default") {
      return NextResponse.json({ ok: true, aktif: "default" });
    }

    const { rows } = await query(
      "UPDATE s5_form_templates SET aktif = true WHERE id = $1 RETURNING *",
      [params.id]
    );
    if (!rows[0]) throw new HttpError(404, "Şablon bulunamadı");
    return NextResponse.json(rows[0]);
  }
);

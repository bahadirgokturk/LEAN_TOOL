import { NextResponse } from "next/server";
import { query } from "@/lib/s5/db";
import { protectedRoute } from "@/lib/s5/route";

/**
 * Reports database columns the deployed code expects but the database lacks.
 *
 * The 5S schema is migrated by pasting the files in `supabase/` into the
 * Supabase SQL Editor by hand. A deploy therefore reaches production before its
 * migration does, and the symptom is always the same: the feature that needs
 * the new column answers 500 while everything else looks healthy. This has cost
 * real audits twice (login lock columns, then `form_template_id`).
 *
 * The admin screen calls this on load and shows a banner, so the gap is visible
 * before a user hits it rather than after.
 */
type RequiredColumn = {
  table: string;
  column: string;
  /** Migration file that adds it. */
  file: string;
  /** What breaks while it is missing. */
  impact: string;
};

const REQUIRED_COLUMNS: RequiredColumn[] = [
  {
    table: "s5_audits",
    column: "form_template_id",
    file: "supabase/s5-form-active.sql",
    impact: "Denetim kaydedilirken hangi formla yapıldığı saklanamaz.",
  },
  {
    table: "s5_form_templates",
    column: "form_tipi",
    file: "supabase/s5-form-tipi.sql",
    impact: "QR form tipine göre soru seti seçilemez; tüm denetimler varsayılan formu kullanır.",
  },
  {
    table: "s5_form_templates",
    column: "aktif",
    file: "supabase/s5-form-active.sql",
    impact: "Varsayılan form şablonu seçilemez.",
  },
  {
    table: "s5_users",
    column: "failed_attempts",
    file: "supabase/s5-security.sql",
    impact: "Hatalı giriş denemeleri sayılamaz (kilitleme devre dışı).",
  },
  {
    table: "s5_users",
    column: "locked_until",
    file: "supabase/s5-security.sql",
    impact: "Brute-force kilitleme devre dışı.",
  },
  {
    table: "s5_users",
    column: "must_change_password",
    file: "supabase/s5-security.sql",
    impact: "Zorunlu şifre değişimi uygulanamaz.",
  },
];

export const GET = protectedRoute({ roles: ["admin"] }, async () => {
  const { rows } = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name::text = ANY($1::text[])`,
    [[...new Set(REQUIRED_COLUMNS.map((c) => c.table))]]
  );

  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = REQUIRED_COLUMNS.filter((c) => !present.has(`${c.table}.${c.column}`));

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    // Every pending file, deduplicated, in the order the admin should run them.
    files: [...new Set(missing.map((c) => c.file))],
  });
});

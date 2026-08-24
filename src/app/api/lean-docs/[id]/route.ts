import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  const { id } = await context.params;
  const { data, error } = await supabase.from("lean_doc_records").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Kayıt bulunamadı veya silme yetkiniz yok." }, { status: 403 });
  return NextResponse.json({ ok: true });
}

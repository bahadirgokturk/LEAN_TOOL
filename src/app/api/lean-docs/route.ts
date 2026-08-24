import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exposePayloadImages, leanDocSchema, persistPayloadImages, recordTypes } from "@/lib/lean-docs";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  const type = new URL(request.url).searchParams.get("type");
  if (type && !recordTypes.includes(type as (typeof recordTypes)[number])) {
    return NextResponse.json({ error: "Geçersiz kayıt türü." }, { status: 400 });
  }
  let query = supabase.from("lean_doc_records").select("id,record_type,document_no,title,payload,created_at,updated_at").order("updated_at", { ascending: false });
  if (type) query = query.eq("record_type", type);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Kayıtlar alınamadı." }, { status: 500 });
  return NextResponse.json((data ?? []).map((row) => ({
    id: row.id,
    recordType: row.record_type,
    documentNo: row.document_no,
    title: row.title,
    payload: exposePayloadImages(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })));
}

export async function POST(request: Request) {
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const parsed = leanDocSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Kayıt alanları geçersiz." }, { status: 400 });
  try {
    const payload = await persistPayloadImages(parsed.data.payload, user.id, supabase);
    const { data: existing } = await supabase.from("lean_doc_records").select("id").eq("id", parsed.data.id).maybeSingle();
    const values = {
      record_type: parsed.data.recordType,
      document_no: parsed.data.documentNo,
      title: parsed.data.title,
      payload,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    const mutation = existing
      ? supabase.from("lean_doc_records").update(values).eq("id", parsed.data.id)
      : supabase.from("lean_doc_records").insert({ ...values, id: parsed.data.id, created_by: user.id });
    const { data, error } = await mutation.select("id").single();
    if (error) return NextResponse.json({ error: "Kayıt kaydedilemedi." }, { status: 403 });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt kaydedilemedi." }, { status: 400 });
  }
}

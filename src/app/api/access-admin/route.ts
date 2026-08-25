import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
  return { supabase, user, isAdmin: roles.includes("lean_tool_access_admin") };
}

export async function GET() {
  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { data, error } = await supabase
    .from("lean_tool_access_requests")
    .select("user_id,email,approved,requested_at,approved_at")
    .order("requested_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Kullanıcılar alınamadı." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: Request) {
  const { supabase, user, isAdmin } = await adminClient();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown; approved?: unknown } | null;
  if (!body || typeof body.userId !== "string" || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { error } = await supabase.from("lean_tool_access_requests")
    .update({ approved: body.approved }).eq("user_id", body.userId);
  if (error) return NextResponse.json({ error: "Onay durumu değiştirilemedi." }, { status: 403 });
  return NextResponse.json({ ok: true });
}

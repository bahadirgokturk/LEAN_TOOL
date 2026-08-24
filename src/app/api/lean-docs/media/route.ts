import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidMediaPath } from "@/lib/lean-docs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!isValidMediaPath(path)) return NextResponse.json({ error: "Geçersiz fotoğraf yolu." }, { status: 400 });
  const { data, error } = await supabase.storage.from("lean-doc-media").download(path);
  if (error || !data) return NextResponse.json({ error: "Fotoğraf bulunamadı." }, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "content-type": data.type || "application/octet-stream",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/s5/http";
import { protectedRoute } from "@/lib/s5/route";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const OBJECT_PATH_PATTERN = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
// Legacy browser uploads used `${Date.now()}-${random}.jpg` at the bucket root.
// Keep those audit photos readable without accepting arbitrary Storage paths.
const LEGACY_OBJECT_PATH_PATTERN = /^\d{10,17}-[a-z0-9]{5,16}\.jpg$/i;
const PHOTO_TYPES = new Map([
  ["image/jpeg", { extension: "jpg", signatures: [[0xff, 0xd8, 0xff]] }],
  ["image/png", { extension: "png", signatures: [[0x89, 0x50, 0x4e, 0x47]] }],
  ["image/webp", { extension: "webp", signatures: [[0x52, 0x49, 0x46, 0x46]] }],
]);

export const POST = protectedRoute({ roles: ["admin", "denetci"] }, async ({ req }) => {
  const form = await req.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) throw new HttpError(400, "Fotoğraf dosyası zorunludur.");
  if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    throw new HttpError(413, "Fotoğraf en fazla 3 MB olabilir.");
  }

  const type = PHOTO_TYPES.get(photo.type);
  if (!type) throw new HttpError(415, "Yalnızca JPEG, PNG veya WebP yüklenebilir.");

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const hasValidSignature = type.signatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
  if (!hasValidSignature) throw new HttpError(415, "Dosya içeriği geçerli bir fotoğraf değil.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new HttpError(503, "Fotoğraf servisi yapılandırılmamış.");

  const objectName = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${type.extension}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/s5-photos/${objectName}`;
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "content-type": photo.type,
      "x-upsert": "false",
    },
    body: bytes,
  });

  if (!upload.ok) throw new HttpError(502, "Fotoğraf depolama servisine yüklenemedi.");
  return NextResponse.json({ url: `/api/s5/photos?path=${encodeURIComponent(objectName)}` }, { status: 201 });
});

/** Serves private audit photos only to an authenticated 5S session. */
export const GET = protectedRoute({}, async ({ req }) => {
  const objectPath = req.nextUrl.searchParams.get("path");
  const hasValidObjectPath =
    objectPath && (OBJECT_PATH_PATTERN.test(objectPath) || LEGACY_OBJECT_PATH_PATTERN.test(objectPath));
  if (!hasValidObjectPath) {
    throw new HttpError(400, "Geçersiz fotoğraf yolu.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new HttpError(503, "Fotoğraf servisi yapılandırılmamış.");

  const download = await fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/s5-photos/${objectPath}`,
    { headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  );
  if (download.status === 404) throw new HttpError(404, "Fotoğraf bulunamadı.");
  if (!download.ok) throw new HttpError(502, "Fotoğraf depolama servisinden alınamadı.");

  return new NextResponse(await download.arrayBuffer(), {
    headers: {
      "content-type": download.headers.get("content-type") || "application/octet-stream",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
});

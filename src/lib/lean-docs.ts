import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const recordTypes = [
  "point_kaizen",
  "rollout_kaizen",
  "operation_standard",
  "equipment",
  "ppe",
] as const;

export const leanDocSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  recordType: z.enum(recordTypes),
  documentNo: z.string().max(160).optional().default(""),
  title: z.string().max(300).optional().default(""),
  payload: z.record(z.string(), z.unknown()),
});

const DATA_IMAGE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MEDIA_MARKER = "lean-media://";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function extensionFor(mime: string) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

function hasValidSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.slice(0, 4).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47][i]);
  return bytes.slice(0, 4).every((b, i) => b === [0x52, 0x49, 0x46, 0x46][i]);
}

export async function persistPayloadImages(
  value: unknown,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<unknown> {
  if (typeof value === "string") {
    const match = DATA_IMAGE.exec(value);
    if (!match) return value.replace(/[<>]/g, "");
    const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || !hasValidSignature(bytes, match[1])) {
      throw new Error("Geçersiz veya 5 MB sınırını aşan fotoğraf.");
    }
    const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extensionFor(match[1])}`;
    const { error } = await supabase.storage.from("lean-doc-media").upload(path, bytes, {
      contentType: match[1],
      upsert: false,
    });
    if (error) throw new Error("Fotoğraf yüklenemedi.");
    return `${MEDIA_MARKER}${path}`;
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => persistPayloadImages(item, userId, supabase)));
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, item]) => [key, await persistPayloadImages(item, userId, supabase)]),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

export function exposePayloadImages(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith(MEDIA_MARKER)) {
    return `/api/lean-docs/media?path=${encodeURIComponent(value.slice(MEDIA_MARKER.length))}`;
  }
  if (Array.isArray(value)) return value.map(exposePayloadImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, exposePayloadImages(item)]));
  }
  return value;
}

export function isValidMediaPath(path: string, userId?: string) {
  const pattern = /^[0-9a-f-]{36}\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
  return pattern.test(path) && (!userId || path.startsWith(`${userId}/`));
}

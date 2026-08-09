import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type RateLimitConfig = {
  endpoint: "ai" | "notify";
  limit: number;
  windowSeconds: number;
};

export async function enforceRateLimit(
  supabase: SupabaseClient,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const { data: allowed, error } = await supabase.rpc("consume_api_rate_limit", {
    p_endpoint: config.endpoint,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    console.error("[security] rate limit check failed", config.endpoint, error.code);
    return NextResponse.json({ error: "Güvenlik kontrolü kullanılamıyor." }, { status: 503 });
  }
  if (allowed !== true) {
    return NextResponse.json(
      { error: "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: { "retry-after": String(config.windowSeconds) } }
    );
  }
  return null;
}

"use client";

// Creates the browser Supabase client once and exposes it on window so the plain-JS
// legacy-app.js (loaded via next/script afterInteractive, after this component renders)
// can pick it up with `const supabase = window.__supabase`.
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    __supabase?: ReturnType<typeof createClient>;
  }
}

if (typeof window !== "undefined" && !window.__supabase) {
  window.__supabase = createClient();
}

export function SupabaseBridge() {
  return null;
}

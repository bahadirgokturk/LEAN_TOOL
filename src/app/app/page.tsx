"use client";

// ARCHITECTURE NOTE (Step 1 of the migration):
//
// The legacy app (2026.05.25_ProjectManagementTool.html) is a single-file HTML/CSS/JS
// prototype built around direct DOM manipulation (hash router, manual innerHTML renders,
// a global `DS` data-access object). Rewriting all of that as idiomatic React components
// is out of scope for this pass, so instead we:
//
//   1. Keep the legacy markup structure (extracted verbatim, minus the PIN/session-picker UI
//      and the client-side API-key settings block) and mount it via dangerouslySetInnerHTML
//      into a plain <div>. React never re-renders inside this subtree; the legacy script
//      owns all DOM updates there, exactly like it did as a static HTML file.
//   2. Ship the legacy JS almost unmodified as `public/legacy-app.js` (plain JS, NOT
//      type-checked by `npm run build` since it lives outside `src/` and nothing imports it
//      from TypeScript) and load it with next/script `afterInteractive`. This avoids
//      fighting the TypeScript compiler over ~4000 lines of untyped legacy code and keeps
//      the diff against the original reviewable.
//   3. The extracted <style> block became `legacy.css`. It is imported here directly
//      (Next.js 13+ App Router allows global CSS imports from any Client Component,
//      not just the root layout, as long as it's a plain top-level import — this builds
//      fine; no need to move it into layout.tsx).
//   4. A tiny SupabaseBridge component (rendered above the <Script> tag, so it runs first)
//      creates the browser Supabase client and assigns it to `window.__supabase` so the
//      legacy script can pick it up as `const supabase = window.__supabase` at boot.
//
// Do NOT edit 2026.05.25_ProjectManagementTool.html — it stays untouched as the historical
// reference/baseline. All behavioral changes now live in legacy-app.js.

import Script from "next/script";
import { useEffect } from "react";
import "./legacy.css";
import { legacyBodyHtml } from "./legacy-markup";
import { SupabaseBridge } from "./supabase-bridge";
import { HubBackLink } from "../_components/HubBackLink";

export default function AppPage() {
  // Lazy-load the PDF exporter on the client and expose it to the legacy script
  // (window.__html2pdf) so "PDF İndir" can download directly without the print dialog.
  useEffect(() => {
    let cancelled = false;
    import("html2pdf.js")
      .then((mod) => {
        if (cancelled) return;
        const fn = (mod as { default?: unknown }).default ?? mod;
        (window as unknown as { __html2pdf?: unknown }).__html2pdf = fn;
      })
      .catch(() => {
        /* PDF export falls back to the browser print dialog if this fails to load */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SupabaseBridge />
      <HubBackLink />
      <div dangerouslySetInnerHTML={{ __html: legacyBodyHtml }} />
      {/* ?v= is a cache-buster: public/ files aren't content-hashed, so browsers/CDN
          can serve a stale legacy-app.js after a deploy. Bump LEGACY_APP_VERSION on
          every change to public/legacy-app.js to force a fresh fetch. */}
      <Script src={`/legacy-app.js?v=${LEGACY_APP_VERSION}`} strategy="afterInteractive" />
    </>
  );
}

const LEGACY_APP_VERSION = "41";

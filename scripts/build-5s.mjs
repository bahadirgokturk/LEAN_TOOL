/**
 * Builds the TypeScript sources of the 5S browser app into `public/5s/js`.
 *
 * The 5S UI is served as plain scripts with no bundler in front of it, so the
 * output is committed and deployment stays exactly as it was: Vercel serves the
 * same static files it always did. Run this after changing anything in
 * `src/5s-client`, and commit both the source and the generated file.
 *
 * Files still written directly in `public/5s/js` are untouched; they are being
 * migrated one at a time.
 */
import { build } from "esbuild";

const ENTRY_POINTS = ["src/5s-client/auth.ts", "src/5s-client/pdf.ts", "src/5s-client/reports.ts"];

const BANNER = `// ============================================================
// OTOMATİK ÜRETİLDİ — elle düzenlemeyin.
// Kaynak: src/5s-client/  ·  Üretmek için: npm run build:5s
// ============================================================`;

const results = await Promise.all(
  ENTRY_POINTS.map((entry) =>
    build({
      entryPoints: [entry],
      outdir: "public/5s/js",
      bundle: true,
      format: "iife",
      // Matches the browsers the plant's tablets and phones actually run.
      target: ["es2019"],
      charset: "utf8",
      // html2pdf carries jsPDF + html2canvas; minifying this on-demand bundle
      // keeps the first PDF download reasonable on auditors' phones.
      minify: entry.endsWith("pdf.ts"),
      banner: { js: BANNER },
      logLevel: "warning",
    })
  )
);

const failed = results.filter((result) => result.errors.length > 0);
if (failed.length > 0) process.exit(1);

console.log(`5S istemci derlendi: ${ENTRY_POINTS.join(", ")}`);

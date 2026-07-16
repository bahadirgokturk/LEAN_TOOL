import type { NextConfig } from "next";

// Statik export: GitHub Pages'te https://bahadirgokturk.github.io/LEAN_TOOL/
// altında yayınlanır. Lokal dev'de basePath yok.
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/LEAN_TOOL" : "",
  images: { unoptimized: true },
};

export default nextConfig;

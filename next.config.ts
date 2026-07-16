import type { NextConfig } from "next";

// Vercel'de tam Next.js uygulaması olarak çalışır (auth + API route'ları var,
// statik export artık kullanılamaz — eski GitHub Pages deploy'u emekli edildi).
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // 5S SPA'sı public/5s/index.html'de yaşar; /5s (ve /5s/?form=...) onu sunar.
      { source: "/5s", destination: "/5s/index.html" },
    ];
  },
};

export default nextConfig;

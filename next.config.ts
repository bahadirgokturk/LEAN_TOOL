import type { NextConfig } from "next";

// Güvenlik başlıkları — tıklama hırsızlığı (clickjacking), MIME sniffing ve
// gereksiz referrer/izin sızıntısına karşı. HSTS'i Vercel zaten ekliyor.
//
// NOT: Katı bir Content-Security-Policy bilinçli olarak eklenmedi; 5S ve Gemba
// eski kod tabanları inline script/handler ve CDN kaynakları kullanıyor, katı
// CSP bunları kırar. CSP eklenmesi ayrı bir iş kalemi (bkz. SECURITY.md).
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  async rewrites() {
    return [
      // 5S SPA'sı public/5s/index.html'de yaşar; /5s (ve /5s/?form=...) onu sunar.
      { source: "/5s", destination: "/5s/index.html" },
    ];
  },
};

export default nextConfig;

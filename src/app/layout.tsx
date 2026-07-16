import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPEX Lean Tool | Saueressig Türkiye",
  description: "Operasyonel mükemmellik modülleri — Saueressig Türkiye OPEX hub sayfası.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}

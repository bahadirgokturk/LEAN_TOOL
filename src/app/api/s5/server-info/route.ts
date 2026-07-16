import { NextResponse, type NextRequest } from "next/server";

// GET /api/s5/server-info — QR kodların işaret edeceği taban adres.
// Orijinalde yerel ağ IP'si dönüyordu; Vercel'de uygulamanın kendi origin'i +
// /5s/ yolu yeterli (auth gerektirmez, sadece adres bilgisi).
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({ networkUrl: `${origin}/5s/`, ip: null, port: null });
}

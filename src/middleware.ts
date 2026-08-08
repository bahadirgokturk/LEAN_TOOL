import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie and gates the Project Management module.
 *
 * Only routes that actually use Supabase Auth reach the auth server. The 5S
 * module carries its own JWT (`s5_token`) and Gemba authenticates client-side,
 * so those paths return immediately — previously every request to them paid for
 * a `getUser()` round-trip whose result was then discarded.
 */
function isSupabaseAuthExempt(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/5s") ||
    pathname.startsWith("/api/s5") ||
    pathname.startsWith("/gemba")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isSupabaseAuthExempt(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api");

  if (!user && isApiRoute) {
    // API callers parse JSON; never answer them with an HTML redirect.
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasApprovedAccess } from "@/lib/auth/access";

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
    // The page itself reports an invalid or expired recovery link, which is
    // clearer than bouncing the user to /login with no explanation.
    pathname === "/reset-password" ||
    pathname.startsWith("/5s") ||
    pathname.startsWith("/api/s5") ||
    pathname.startsWith("/gemba")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Recovery and confirmation links sometimes land on /login instead of the
  // verification route, depending on how the Supabase email template is
  // configured. Forward them so the session is established before the user is
  // shown a form; otherwise the parameters are ignored and the user is stuck
  // looking at the sign-in screen.
  if (pathname === "/login") {
    if (searchParams.has("token_hash")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/confirm";
      return NextResponse.redirect(url);
    }
    if (searchParams.has("code")) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      return NextResponse.redirect(url);
    }
  }

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
  const isApproved = hasApprovedAccess(user);

  if (!user && isApiRoute) {
    // API callers parse JSON; never answer them with an HTML redirect.
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && !isApproved && isApiRoute) {
    return NextResponse.json({ error: "Hesabınız henüz yönetici tarafından onaylanmadı." }, { status: 403 });
  }

  if (user && !isApproved && !isLoginPage) {
    // A corporate mail scanner can open confirmation links automatically. A
    // confirmed mailbox therefore never grants internal-tool access by itself.
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "access_pending");
    const redirect = NextResponse.redirect(url);
    request.cookies.getAll()
      .filter(({ name }) => name.startsWith("sb-"))
      .forEach(({ name }) => redirect.cookies.set(name, "", { expires: new Date(0), path: "/" }));
    return redirect;
  }

  if (user && isApproved && isLoginPage) {
    const url = request.nextUrl.clone();
    const next = searchParams.get("next");
    url.pathname = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

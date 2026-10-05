import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
};

const PASSWORD_PAGE = "/account/password";

// Which role sections each role may open. Admins also run events, so they
// get the officer section too.
const ALLOWED_SECTIONS: Record<string, string[]> = {
  admin: ["admin", "officer"],
  officer: ["officer"],
  student: ["student"],
};

export async function proxy(request: NextRequest) {
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

  // Redirects must carry any refreshed session cookies, or the browser keeps
  // the stale token and the user is logged out on the next request.
  function redirectTo(pathname: string) {
    const redirect = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  if (!userId) {
    // API callers get JSON they can show, not a login page's HTML.
    if (isApi) return NextResponse.json({ error: "Your session has expired. Please log in again." }, { status: 401 });
    if (path === "/login") return response;
    return redirectTo("/login");
  }

  // API routes check roles themselves (requireRole); skip the profile lookup.
  if (isApi) return response;

  // select("*") rather than naming the newer columns, so a database that
  // hasn't had migration 0002 applied yet still gets role protection instead
  // of a failed query that would let everyone through.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  const role = profile?.role as string | undefined;

  // Authenticated but no matching profiles row (or an unrecognized role) —
  // e.g. an Auth user created in the dashboard without a profile. Sign them
  // out so they can't open any section; signing out (rather than just
  // redirecting) is what keeps this from looping back here.
  if (!role || !ROLE_HOME[role]) {
    await supabase.auth.signOut();
    return redirectTo("/login?noprofile=1");
  }

  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    return redirectTo("/login?deactivated=1");
  }

  if (profile?.must_change_password === true && path !== PASSWORD_PAGE) {
    return redirectTo(PASSWORD_PAGE);
  }

  if (path === "/login" || path === "/") {
    return redirectTo(ROLE_HOME[role]);
  }

  // keep each role inside its own section (e.g. a student can't open /admin)
  const section = path.split("/")[1];
  if (["admin", "officer", "student"].includes(section) && !ALLOWED_SECTIONS[role].includes(section)) {
    return redirectTo(ROLE_HOME[role]);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

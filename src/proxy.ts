import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
};


export async function proxy(request: NextRequest) {
  // Scheduled jobs (Vercel Cron) have no user session; those routes check
  // their own CRON_SECRET instead.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();

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

  // Everything below needs the profile, which costs a database round trip.
  // Only the entry points ("/" and "/login") need it here, to send the user
  // to their role's home. Section access and deactivation are enforced by
  // the section layouts (RoleLayout), which
  // load the profile anyway; API routes enforce roles with requireRole.
  if (path !== "/" && path !== "/login") return response;

  // select("*") rather than naming the newer columns, so a database that
  // hasn't had migration 0002 applied yet doesn't fail the query.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const role = profile?.role as string | undefined;

  // Authenticated but no matching profiles row (or an unrecognized role) —
  // e.g. an Auth user created in the dashboard without a profile. Sign them
  // out; signing out (rather than just redirecting) prevents a redirect loop.
  if (!role || !ROLE_HOME[role]) {
    await supabase.auth.signOut();
    return redirectTo("/login?noprofile=1");
  }

  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    return redirectTo("/login?deactivated=1");
  }

  return redirectTo(ROLE_HOME[role]);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

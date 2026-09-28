import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  officer: "/officer",
  student: "/student",
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/api/auth") || path === "/";

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role as string | undefined;

    // Authenticated but no matching profiles row (or an unrecognized role) —
    // there's nowhere valid to send them, so let the request through as-is
    // rather than bouncing to /login, which would just loop forever since
    // the user is still signed in on the next request too.
    if (!role || !ROLE_HOME[role]) {
      return response;
    }

    if (path === "/login" || path === "/") {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }

    // keep each role inside its own section (e.g. a student can't open /admin)
    const section = path.split("/")[1];
    if (["admin", "officer", "student"].includes(section) && role !== section) {
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

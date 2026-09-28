import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client that acts as the signed-in user (respects RLS).
// Use this for reads in server components and API routes.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no request context — ignore,
            // middleware.ts is what actually refreshes the session cookie.
          }
        },
      },
    }
  );
}

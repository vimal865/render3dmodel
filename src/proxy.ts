// Refreshes the Supabase auth token on every request.
//
// Without this, access tokens expire (roughly hourly) and are never
// refreshed on the server. The symptom is users being signed out at
// apparently random moments, mid-session, with no explanation — one of
// the more damaging bugs to ship because it looks like data loss to the
// user and is hard to reproduce deliberately.
//
// Next.js 16 renamed the `middleware` convention to `proxy`. The exported
// function must be named `proxy`.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Calling getUser() is what triggers the refresh and rewrites the
  // cookies. Do not remove it, and do not run code between creating the
  // client and this call — the session state is only settled afterwards.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets and image optimisation, which don't need a session
  // and would otherwise pay the cost of a refresh check on every file.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

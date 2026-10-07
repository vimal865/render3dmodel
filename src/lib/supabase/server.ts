// Supabase client for use on the server (Route Handlers, Server Components).
// Reads/writes the auth session via cookies, so requests know who's signed in.
//
// Next.js 16 requires cookies() to be awaited, so this factory is async —
// call it as `await createClient()` everywhere it's used.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
            // Called from a context that can't set cookies (e.g. a Server
            // Component render). Safe to ignore — the session is still
            // read correctly; it just won't be refreshed on this request.
          }
        },
      },
    }
  );
}

// Service-role client for server-side work that must bypass RLS —
// e.g. writing analysis/render results after verifying the user server-side.
// NEVER import this into anything that ships to the browser.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

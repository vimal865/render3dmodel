// Supabase client for use in Client Components (the browser).
// Safe to use the anon key here — Row Level Security policies (see
// supabase/schema.sql) are what actually keep data private, not this key.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Thin auth wrapper.
//
// Route handlers and components should import getCurrentUser() /
// requireAuth() from here — never call supabase.auth.* directly outside
// this file. That's the one decision that makes an eventual auth provider
// swap (Cognito, custom JWT, whatever AWS migration needs) a rewrite of
// this file only, not a search-and-replace across the whole app.

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

export type UserProfile = {
  id: string;
  display_name: string | null;
  studio_name: string | null;
  created_at: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return { id: user.id, email: user.email ?? null };
}

// Profile row is created automatically by a DB trigger on signup
// (see supabase/schema.sql), so this should always find a row for a
// valid user — but handle absence gracefully rather than throwing.
export async function getProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, studio_name, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }
  return data as UserProfile | null;
}

export async function updateProfile(
  userId: string,
  fields: { display_name?: string | null; studio_name?: string | null }
): Promise<UserProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", userId)
    .select("id, display_name, studio_name, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save profile");
  }
  return data as UserProfile;
}

// Use in API routes that require a signed-in user. Throws a Response-like
// error the route handler can catch and return directly.
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Not signed in");
  }
  return user;
}

export class AuthError extends Error {
  status = 401;
}

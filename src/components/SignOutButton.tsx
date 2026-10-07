"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { reportActivity } from "@/lib/report-activity";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    // Reported before sign-out so the session still identifies the user.
    reportActivity("auth.sign_out");
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="font-tech text-xs uppercase tracking-wide text-graphite hover:text-cyan-accent"
    >
      Sign out
    </button>
  );
}

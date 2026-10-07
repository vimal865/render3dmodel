// Completes email-link auth flows.
//
// Supabase sends confirmation and password-reset emails containing a
// token_hash. This route exchanges that hash for a real session cookie.
// Without it, clicking the link in an email does nothing useful.
//
// IMPORTANT setup step: in the Supabase Dashboard under
// Authentication -> Email Templates, the templates must point here. See
// README.md ("Configure email templates") — the default templates use a
// different URL shape and will NOT hit this route.

import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only allow relative redirects — an absolute URL here would be an
  // open-redirect hole (attacker emails a link that lands on their site
  // with a valid session).
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      await logEvent({
        event: "auth.email_confirmed",
        userId: data.user?.id ?? null,
        resourceType: "session",
        metadata: { type },
        request,
      });
      redirect(next);
    }

    await logEvent({
      event: "auth.confirm_failed",
      userId: null,
      status: "failure",
      metadata: { type },
      errorMessage: error.message,
      request,
    });
    redirect(`/auth/error?reason=${encodeURIComponent(error.message)}`);
  }

  await logEvent({
    event: "auth.confirm_failed",
    userId: null,
    status: "failure",
    errorMessage: "Missing token_hash or type",
    request,
  });
  redirect("/auth/error?reason=Missing%20or%20invalid%20link");
}

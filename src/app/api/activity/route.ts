// Client-reported activity events.
//
// Auth actions (sign in, sign out, password change) happen through the
// Supabase client in the browser, so the server never sees them unless
// the client reports them.
//
// Two safeguards, because a client-writable log is otherwise a way to
// forge an audit trail:
//
//   1. Only events on the allow-list below are accepted. Anything else
//      is rejected — a client cannot log "render.completed" and fake a
//      transaction that never happened.
//   2. user_id always comes from the server-verified session, never
//      from the request body. A client cannot write into someone
//      else's history.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logEvent, type ActivityEvent } from "@/lib/activity-log";

// Deliberately excludes anything with a cost or a resource attached.
const CLIENT_REPORTABLE: ActivityEvent[] = [
  "auth.sign_up",
  "auth.sign_in",
  "auth.sign_out",
  "auth.password_reset_requested",
  "auth.password_changed",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const event = body?.event as ActivityEvent;

    if (!CLIENT_REPORTABLE.includes(event)) {
      return NextResponse.json({ error: "Event not accepted" }, { status: 400 });
    }

    // Sign-out is reported after the session is torn down, and a reset
    // request happens while signed out, so a null user is expected for
    // some events rather than an error.
    const user = await getCurrentUser();

    await logEvent({
      event,
      userId: user?.id ?? null,
      resourceType: "session",
      status: body?.status === "failure" ? "failure" : "success",
      metadata: { reportedBy: "client" },
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Activity report failed:", err);
    // Never surface a logging failure to the user — the auth action
    // itself already succeeded.
    return NextResponse.json({ ok: false });
  }
}

// Client-side helper for reporting auth events to the audit log.
//
// Fire-and-forget by design: if the report fails, the user's sign-in
// still succeeded and there is nothing useful to tell them about it.

export type ClientEvent =
  | "auth.sign_up"
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.password_reset_requested"
  | "auth.password_changed";

export function reportActivity(event: ClientEvent): void {
  void fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    // Survives the page navigation that usually follows an auth action.
    keepalive: true,
  }).catch(() => {
    /* logging must never disrupt the flow */
  });
}

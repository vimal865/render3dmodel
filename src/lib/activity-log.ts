// Activity log.
//
// Records every meaningful transaction: auth events, uploads, analyses,
// renders, downloads, profile changes, and quota denials. Two reasons
// this matters more here than in a typical CRUD app:
//
//   1. Every AI call costs real money. Without per-event cost attribution
//      you find out what you spent from the credit card statement, not
//      from your own system.
//   2. When a user says "my render failed", the log is the only way to
//      know whether it was a timeout, a quota denial, a bad upload, or
//      an upstream outage.
//
// Design rules:
//
//   - Writes use the service-role client, and regular users have no
//     insert/update/delete policy on the table. An audit trail the
//     subject can edit is not an audit trail.
//   - logEvent() never throws. A logging failure must not fail the
//     transaction it is describing.
//   - No image bytes, no secrets, no full prompts. Metadata only.

import { createServiceClient } from "@/lib/supabase/server";

export type ActivityEvent =
  // auth
  | "auth.sign_up"
  | "auth.sign_in"
  | "auth.sign_out"
  | "auth.email_confirmed"
  | "auth.confirm_failed"
  | "auth.password_reset_requested"
  | "auth.password_changed"
  // pipeline
  | "upload.created"
  | "upload.rejected"
  | "upload.analyzed"
  | "upload.failed"
  | "render.requested"
  | "render.completed"
  | "render.failed"
  | "render.downloaded"
  // account
  | "profile.updated"
  // guardrails
  | "quota.denied";

export type ActivityStatus = "success" | "failure" | "denied";

export type LogInput = {
  event: ActivityEvent;
  userId: string | null;
  status?: ActivityStatus;
  resourceType?: "upload" | "render" | "profile" | "session";
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  estimatedCostUsd?: number;
  errorMessage?: string | null;
  request?: Request;
};

// Published Gemini rates, August 2026. Kept here rather than inline so
// there is one place to update when Google changes pricing — which it
// has done more than once this year.
const COST_USD = {
  analysis: 0.015,
  render: { "1K": 0.039, "2K": 0.134, "4K": 0.24 },
} as const;

export function analysisCost(): number {
  return COST_USD.analysis;
}

export function renderCost(resolution: "1K" | "2K" | "4K"): number {
  return COST_USD.render[resolution] ?? COST_USD.render["2K"];
}

// IP addresses are personal data under India's DPDP Act and the GDPR.
// Set LOG_IP_ADDRESSES=false to stop collecting them; the rest of the
// log still works and remains useful.
const LOG_IPS = process.env.LOG_IP_ADDRESSES !== "false";

function requestContext(request?: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!request) return { ip: null, userAgent: null };

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = LOG_IPS
    ? (forwarded?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null)
    : null;

  return {
    ip,
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  };
}

export async function logEvent(input: LogInput): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { ip, userAgent } = requestContext(input.request);

    const { error } = await supabase.from("activity_log").insert({
      user_id: input.userId,
      event: input.event,
      status: input.status ?? "success",
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
      duration_ms: input.durationMs ?? null,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      error_message: input.errorMessage?.slice(0, 1000) ?? null,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error("Activity log write failed:", error.message, input.event);
    }
  } catch (err) {
    // Deliberately swallowed. If logging is broken, the user's render
    // should still succeed — we lose an audit row, not their work.
    console.error("Activity log threw:", err);
  }
}

// Small helper for timing a transaction without repeating Date.now()
// bookkeeping in every route.
export function startTimer(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type ActivityRecord = {
  id: string;
  event: ActivityEvent;
  status: ActivityStatus;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  duration_ms: number | null;
  estimated_cost_usd: number | null;
  error_message: string | null;
  created_at: string;
};

export async function listActivity(
  userId: string,
  limit = 20
): Promise<ActivityRecord[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("activity_log")
    .select(
      "id, event, status, resource_type, resource_id, metadata, duration_ms, estimated_cost_usd, error_message, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Activity read failed:", error.message);
    return [];
  }
  return (data ?? []) as ActivityRecord[];
}

export type SpendSummary = {
  today: number;
  last30Days: number;
  rendersToday: number;
};

export async function getSpendSummary(userId: string): Promise<SpendSummary> {
  const supabase = createServiceClient();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("activity_log")
    .select("event, estimated_cost_usd, created_at")
    .eq("user_id", userId)
    .not("estimated_cost_usd", "is", null)
    .gte("created_at", monthAgo);

  if (error || !data) {
    return { today: 0, last30Days: 0, rendersToday: 0 };
  }

  let today = 0;
  let last30Days = 0;
  let rendersToday = 0;

  for (const row of data as {
    event: string;
    estimated_cost_usd: number;
    created_at: string;
  }[]) {
    const cost = Number(row.estimated_cost_usd) || 0;
    last30Days += cost;
    if (row.created_at >= dayAgo) {
      today += cost;
      if (row.event === "render.completed") rendersToday += 1;
    }
  }

  return {
    today: Number(today.toFixed(4)),
    last30Days: Number(last30Days.toFixed(4)),
    rendersToday,
  };
}

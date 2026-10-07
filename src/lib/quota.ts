// Spend control.
//
// Every render is a paid API call (~USD 0.15 at 2K, ~0.25 at 4K), and
// every analysis is a smaller one. Without limits a single account —
// malicious, buggy, or just enthusiastic — can run up an unbounded bill
// against a personal credit card. These checks run before any AI call.
//
// Two layers, because they defend against different things:
//
//   Daily quota  — fairness and total spend. Counts renders that were
//                  actually produced (or are in flight). Failed renders
//                  don't count against the user, since a failure is
//                  usually our problem, not theirs.
//
//   Burst limit  — abuse and runaway loops. Counts every attempt in a
//                  short window, including failures, so a client stuck
//                  retrying can't bypass the daily quota by failing.
//
// When credits/pricing arrive in a later phase, these become the
// enforcement point rather than being replaced.

import { createClient } from "@/lib/supabase/server";

export const DAILY_RENDER_LIMIT = Number(
  process.env.DAILY_RENDER_LIMIT ?? 20
);
export const DAILY_ANALYSIS_LIMIT = Number(
  process.env.DAILY_ANALYSIS_LIMIT ?? 100
);
const BURST_WINDOW_SECONDS = 60;
const BURST_LIMIT = 3;

export class QuotaError extends Error {
  status = 429;
  constructor(
    message: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
  }
}

function isoSecondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

export async function assertRenderQuota(userId: string): Promise<void> {
  const supabase = await createClient();

  const { count: burstCount, error: burstError } = await supabase
    .from("renders")
    .select("id, uploads!inner(user_id)", { count: "exact", head: true })
    .eq("uploads.user_id", userId)
    .gte("created_at", isoSecondsAgo(BURST_WINDOW_SECONDS));

  if (burstError) {
    // Fail closed. If the quota check itself is broken, refusing the
    // request is the safe outcome — the alternative is an unmetered
    // spend path that opens exactly when the database is unhealthy.
    console.error("Burst quota check failed:", burstError.message);
    throw new QuotaError("Could not verify your usage. Try again shortly.");
  }

  if ((burstCount ?? 0) >= BURST_LIMIT) {
    throw new QuotaError(
      "You're rendering very quickly. Wait a moment and try again.",
      BURST_WINDOW_SECONDS
    );
  }

  const { count: dailyCount, error: dailyError } = await supabase
    .from("renders")
    .select("id, uploads!inner(user_id)", { count: "exact", head: true })
    .eq("uploads.user_id", userId)
    .neq("status", "failed")
    .gte("created_at", isoSecondsAgo(24 * 60 * 60));

  if (dailyError) {
    console.error("Daily quota check failed:", dailyError.message);
    throw new QuotaError("Could not verify your usage. Try again shortly.");
  }

  if ((dailyCount ?? 0) >= DAILY_RENDER_LIMIT) {
    throw new QuotaError(
      `You've used all ${DAILY_RENDER_LIMIT} renders for today. Your limit resets 24 hours after your first render.`
    );
  }
}

export async function assertAnalysisQuota(userId: string): Promise<void> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", isoSecondsAgo(24 * 60 * 60));

  if (error) {
    console.error("Analysis quota check failed:", error.message);
    throw new QuotaError("Could not verify your usage. Try again shortly.");
  }

  if ((count ?? 0) >= DAILY_ANALYSIS_LIMIT) {
    throw new QuotaError(
      `You've reached today's upload limit of ${DAILY_ANALYSIS_LIMIT}. It resets 24 hours after your first upload.`
    );
  }
}

// Used by the UI to show remaining renders before the user commits to one.
export async function getRemainingRenders(userId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("renders")
    .select("id, uploads!inner(user_id)", { count: "exact", head: true })
    .eq("uploads.user_id", userId)
    .neq("status", "failed")
    .gte("created_at", isoSecondsAgo(24 * 60 * 60));

  if (error) return DAILY_RENDER_LIMIT;
  return Math.max(0, DAILY_RENDER_LIMIT - (count ?? 0));
}

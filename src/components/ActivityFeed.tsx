import type { ActivityRecord, SpendSummary } from "@/lib/activity-log";

const EVENT_LABELS: Record<string, string> = {
  "auth.sign_up": "Account created",
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "auth.email_confirmed": "Email confirmed",
  "auth.confirm_failed": "Email link failed",
  "auth.password_reset_requested": "Password reset requested",
  "auth.password_changed": "Password changed",
  "upload.created": "Model uploaded",
  "upload.rejected": "Upload rejected",
  "upload.analyzed": "Design analysed",
  "upload.failed": "Analysis failed",
  "render.requested": "Render requested",
  "render.completed": "Render completed",
  "render.failed": "Render failed",
  "render.downloaded": "Render downloaded",
  "profile.updated": "Profile updated",
  "quota.denied": "Daily limit reached",
};

function statusColor(status: string): string {
  if (status === "failure") return "text-signal";
  if (status === "denied") return "text-signal/80";
  return "text-cyan-accent";
}

function formatWhen(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return then.toLocaleDateString();
}

export default function ActivityFeed({
  activity,
  spend,
}: {
  activity: ActivityRecord[];
  spend: SpendSummary;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-tech text-xs uppercase tracking-widest text-graphite">
        Activity
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SpendCard label="Spend today" value={`$${spend.today.toFixed(3)}`} />
        <SpendCard
          label="Last 30 days"
          value={`$${spend.last30Days.toFixed(2)}`}
        />
        <SpendCard label="Renders today" value={String(spend.rendersToday)} />
      </div>
      <p className="mt-2 font-body text-xs text-graphite">
        Estimated from published API rates — indicative, not a bill.
      </p>

      {activity.length === 0 ? (
        <p className="mt-4 border border-blueprint-lighter bg-blueprint-light/40 px-4 py-8 text-center font-body text-sm text-graphite">
          No activity recorded yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-blueprint-lighter border border-blueprint-lighter bg-blueprint-light/40">
          {activity.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <span className="font-body text-sm text-linework">
                {EVENT_LABELS[row.event] ?? row.event}
                {row.status !== "success" && (
                  <span className={`ml-2 font-tech text-xs ${statusColor(row.status)}`}>
                    {row.status}
                  </span>
                )}
              </span>

              <span className="flex items-center gap-3 font-tech text-xs text-graphite">
                {typeof row.estimated_cost_usd === "number" && (
                  <span>${Number(row.estimated_cost_usd).toFixed(3)}</span>
                )}
                {typeof row.duration_ms === "number" && (
                  <span>{(row.duration_ms / 1000).toFixed(1)}s</span>
                )}
                <time dateTime={row.created_at}>
                  {formatWhen(row.created_at)}
                </time>
              </span>

              {row.error_message && (
                <p className="w-full font-tech text-xs text-signal/80">
                  {row.error_message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpendCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-blueprint-lighter bg-blueprint-light/40 px-4 py-3">
      <p className="font-tech text-xs uppercase tracking-wide text-graphite">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold text-linework">
        {value}
      </p>
    </div>
  );
}

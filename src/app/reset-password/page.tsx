"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { reportActivity } from "@/lib/report-activity";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const router = useRouter();

  // Landing here should mean /auth/confirm already exchanged the reset
  // token for a session. If there's no session, the link was bad or
  // expired — say so instead of showing a form that can't work.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(Boolean(data.session));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    reportActivity("auth.password_changed");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-cyan-accent">
          RENDERDROP · NEW PASSWORD
        </p>

        {sessionReady === false ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
              This link has expired
            </h1>
            <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
              Reset links can only be used once and expire after about an
              hour. Request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90"
            >
              Request a new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
              Set a new password
            </h1>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-tech text-xs uppercase tracking-wide text-graphite">
                  New password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none focus:border-cyan-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-tech text-xs uppercase tracking-wide text-graphite">
                  Confirm password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none focus:border-cyan-accent"
                />
              </label>

              {error && <p className="font-body text-sm text-signal">{error}</p>}

              <button
                type="submit"
                disabled={loading || sessionReady === null}
                className="mt-2 bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

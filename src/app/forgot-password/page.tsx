"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { reportActivity } from "@/lib/report-activity";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    setLoading(false);

    // Deliberately show the same confirmation whether or not the address
    // has an account — otherwise this page becomes a way to check which
    // emails are registered.
    if (error && !error.message.toLowerCase().includes("not found")) {
      setError(error.message);
      return;
    }
    reportActivity("auth.password_reset_requested");
    setSent(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-cyan-accent">
          RENDERDROP · PASSWORD RESET
        </p>

        {sent ? (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
              Check your email
            </h1>
            <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
              If an account exists for{" "}
              <span className="text-linework">{email}</span>, a reset link is
              on its way. The link expires in about an hour.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
              Reset your password
            </h1>
            <p className="mt-2 font-body text-sm text-graphite">
              We&rsquo;ll email you a link to set a new one.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-tech text-xs uppercase tracking-wide text-graphite">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none focus:border-cyan-accent"
                />
              </label>

              {error && <p className="font-body text-sm text-signal">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}

        <Link
          href="/login"
          className="mt-6 inline-block font-body text-sm text-graphite underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

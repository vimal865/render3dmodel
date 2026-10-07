"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { reportActivity } from "@/lib/report-activity";

export default function LoginPage() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === "signUp") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      // If email confirmation is turned off in the Supabase project,
      // signUp returns a live session and the user is already signed in.
      // Telling them to check their email in that case leaves them
      // stranded on a page they've already passed.
      reportActivity("auth.sign_up");
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setCheckEmail(true);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    reportActivity("auth.sign_in");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-cyan-accent">
          RENDERDROP · ACCESS
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
          {mode === "signIn" ? "Sign in" : "Create your account"}
        </h1>

        {checkEmail ? (
          <p className="mt-6 font-body text-sm text-graphite">
            Check <span className="text-linework">{email}</span> for a
            confirmation link, then sign in.
          </p>
        ) : (
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
                suppressHydrationWarning
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-tech text-xs uppercase tracking-wide text-graphite">
                Password
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none focus:border-cyan-accent"
                suppressHydrationWarning
              />
            </label>

            {error && (
              <p className="font-body text-sm text-signal">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90 disabled:opacity-50"
              suppressHydrationWarning
            >
              {loading
                ? "Working..."
                : mode === "signIn"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
              setCheckEmail(false);
            }}
            className="text-left font-body text-sm text-graphite underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
            suppressHydrationWarning
          >
            {mode === "signIn"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          {mode === "signIn" && (
            <Link
              href="/forgot-password"
              className="font-body text-sm text-graphite underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
            >
              Forgot your password?
            </Link>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-blueprint-lighter pt-4 font-tech text-xs text-graphite">
          <Link
            href="/privacy"
            className="underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
          >
            Terms
          </Link>
          <a
            href="mailto:vimalrajelash@gmail.com"
            className="underline decoration-blueprint-lighter underline-offset-4 hover:text-cyan-accent"
          >
            Support
          </a>
        </div>
      </div>
    </div>
  );
}

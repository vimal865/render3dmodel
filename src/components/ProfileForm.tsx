"use client";

import { useState } from "react";

export default function ProfileForm({
  email,
  displayName: initialDisplayName,
  studioName: initialStudioName,
}: {
  email: string | null;
  displayName: string;
  studioName: string;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [studioName, setStudioName] = useState(initialStudioName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          studio_name: studioName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");

      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setStatus("idle");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="registration-marks mt-6 border border-blueprint-lighter bg-blueprint-light/60 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="font-tech text-xs uppercase tracking-wide text-graphite">
            Display name
          </span>
          <input
            type="text"
            value={displayName}
            maxLength={80}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none placeholder:text-graphite/50 focus:border-cyan-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-tech text-xs uppercase tracking-wide text-graphite">
            Studio / firm
          </span>
          <input
            type="text"
            value={studioName}
            maxLength={120}
            onChange={(e) => setStudioName(e.target.value)}
            placeholder="Optional"
            className="border border-blueprint-lighter bg-blueprint px-3 py-2 font-body text-sm text-linework outline-none placeholder:text-graphite/50 focus:border-cyan-accent"
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="font-tech text-xs uppercase tracking-wide text-graphite">
          Email
        </p>
        <p className="mt-1 font-body text-sm text-linework">{email}</p>
        <p className="mt-1 font-body text-xs text-graphite">
          Your email is fixed to your account and can&rsquo;t be changed here.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-4 border-t border-blueprint-lighter pt-6">
        <button
          type="submit"
          disabled={status === "saving"}
          className="bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving..." : "Save changes"}
        </button>

        {status === "saved" && (
          <span className="font-body text-sm text-cyan-accent">Saved</span>
        )}
        {error && <span className="font-body text-sm text-signal">{error}</span>}
      </div>
    </form>
  );
}

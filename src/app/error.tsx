"use client";

// Without this, an unhandled render error shows the user a blank white
// page with no way forward. This catches it and offers a recovery path.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-signal">
          RENDERDROP · UNEXPECTED ERROR
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
          Something broke
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
          This wasn&rsquo;t supposed to happen. Your work up to this point is
          saved — try again, and if it keeps happening, reload the page.
        </p>
        {error.digest && (
          <p className="mt-3 font-tech text-xs text-graphite/70">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

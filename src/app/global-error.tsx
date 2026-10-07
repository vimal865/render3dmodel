"use client";

// error.tsx can't catch errors thrown by the root layout itself (fonts,
// providers, anything above the page tree) -- this is the only boundary
// that can, which is why it has to render its own <html>/<body> instead
// of relying on RootLayout. Importing globals.css directly here is what
// keeps it on-brand despite bypassing the layout that normally loads it.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root-layout error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center px-6">
        <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
          <p className="font-tech text-xs tracking-widest text-signal">
            RENDERDROP · UNEXPECTED ERROR
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
            Something broke
          </h1>
          <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
            The page itself failed to load. Reloading usually fixes this.
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
      </body>
    </html>
  );
}

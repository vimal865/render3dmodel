// Server + edge error reporting. Inert until NEXT_PUBLIC_SENTRY_DSN is set --
// no Sentry account configured yet means no init call, no network traffic.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation.md for the register()/onRequestError() contract this file
// implements.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export const onRequestError = Sentry.captureRequestError;

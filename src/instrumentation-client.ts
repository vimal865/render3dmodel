// Browser-side error reporting. Runs before hydration; inert until
// NEXT_PUBLIC_SENTRY_DSN is set. See node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/instrumentation-client.md.

import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

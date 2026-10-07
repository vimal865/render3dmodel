import Link from "next/link";

export default async function AuthErrorPage(props: PageProps<"/auth/error">) {
  const params = await props.searchParams;
  const reason = typeof params.reason === "string" ? params.reason : null;

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-signal">
          RENDERDROP · LINK PROBLEM
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
          That link didn&rsquo;t work
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
          Email links expire after a short time and can only be used once.
          Request a new one and try again.
        </p>
        {reason && (
          <p className="mt-3 font-tech text-xs text-graphite/70">{reason}</p>
        )}
        <Link
          href="/login"
          className="mt-6 inline-block bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

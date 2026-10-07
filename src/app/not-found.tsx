import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="registration-marks w-full max-w-sm border border-blueprint-lighter bg-blueprint-light/60 p-8">
        <p className="font-tech text-xs tracking-widest text-cyan-accent">
          RENDERDROP · 404
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-linework">
          Nothing here
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-graphite">
          That page doesn&rsquo;t exist. It may have moved, or the link may be
          wrong.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90"
        >
          Back to renders
        </Link>
      </div>
    </div>
  );
}

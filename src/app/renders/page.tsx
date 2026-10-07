import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listUserRendersPaginated } from "@/lib/render-service";
import SignOutButton from "@/components/SignOutButton";
import type { RenderWithContext } from "@/lib/types";

const PAGE_SIZE = 24;

export default async function RendersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { renders, totalCount, totalPages } = await listUserRendersPaginated(
    user.id,
    { page, pageSize: PAGE_SIZE }
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-blueprint-light px-6 py-4">
        <Link href="/">
          <p className="font-tech text-xs tracking-widest text-cyan-accent">
            RENDERDROP
          </p>
          <p className="font-body text-xs text-graphite">My renders</p>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/profile"
            className="font-tech text-xs uppercase tracking-wide text-graphite transition-colors hover:text-cyan-accent"
          >
            Profile
          </Link>
          <SignOutButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-semibold text-linework">
            My renders
          </h1>
          <p className="font-tech text-xs text-graphite">{totalCount} total</p>
        </div>

        {renders.length === 0 ? (
          <p className="mt-6 border border-blueprint-lighter bg-blueprint-light/40 px-4 py-8 text-center font-body text-sm text-graphite">
            No renders yet.{" "}
            <Link href="/" className="text-cyan-accent underline underline-offset-4">
              Upload a model
            </Link>{" "}
            to make your first one.
          </p>
        ) : (
          <>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {renders.map((render) => (
                <RenderCard key={render.id} render={render} />
              ))}
            </ul>
            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} />}
          </>
        )}
      </main>
    </div>
  );
}

function RenderCard({ render }: { render: RenderWithContext }) {
  const statusColor =
    render.status === "failed"
      ? "text-signal"
      : render.status === "complete"
        ? "text-cyan-accent"
        : "text-graphite";

  return (
    <li className="registration-marks border border-blueprint-lighter bg-blueprint-light/40">
      {render.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={render.url}
          alt={render.style ? `${render.style} render` : "Render"}
          className="aspect-4/3 w-full object-cover"
        />
      ) : (
        <div className="flex aspect-4/3 w-full items-center justify-center font-tech text-xs text-graphite">
          {render.status === "failed" ? "Failed" : "Processing"}
        </div>
      )}

      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center justify-between font-tech text-xs">
          <span className={statusColor}>{render.status}</span>
          <span className="text-graphite">{render.resolution}</span>
        </div>

        {(render.style || render.spaceType) && (
          <p className="font-body text-sm text-linework">
            {render.style}
            {render.style && render.spaceType ? " · " : ""}
            {render.spaceType}
          </p>
        )}

        {render.finishes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {render.finishes.map((swatch, i) => (
              <span
                key={`${swatch.label}-${i}`}
                className="flex items-center gap-1.5 border border-blueprint-lighter bg-blueprint px-1.5 py-1"
              >
                <span
                  className="h-3 w-3 border border-blueprint-lighter"
                  style={{ backgroundColor: swatch.hex }}
                  aria-hidden="true"
                />
                <span className="font-tech text-[10px] text-linework">
                  {swatch.label}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <time dateTime={render.created_at} className="font-tech text-xs text-graphite">
            {new Date(render.created_at).toLocaleDateString()}
          </time>
          {render.status === "complete" && render.url && (
            <a
              href={`/api/renders/${render.id}/download`}
              className="bg-signal px-3 py-1.5 font-display text-xs font-semibold text-blueprint transition-opacity hover:opacity-90"
            >
              Download
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <nav className="mt-8 flex items-center justify-center gap-4 font-tech text-xs">
      {page > 1 ? (
        <Link href={`/renders?page=${page - 1}`} className="text-cyan-accent hover:underline">
          Previous
        </Link>
      ) : (
        <span className="text-graphite opacity-50">Previous</span>
      )}
      <span className="text-graphite">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`/renders?page=${page + 1}`} className="text-cyan-accent hover:underline">
          Next
        </Link>
      ) : (
        <span className="text-graphite opacity-50">Next</span>
      )}
    </nav>
  );
}

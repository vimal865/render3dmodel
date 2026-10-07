import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { listUserRenders } from "@/lib/render-service";
import { listActivity, getSpendSummary } from "@/lib/activity-log";
import ProfileForm from "@/components/ProfileForm";
import ActivityFeed from "@/components/ActivityFeed";
import SignOutButton from "@/components/SignOutButton";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, renders, activity, spend] = await Promise.all([
    getProfile(user.id),
    listUserRenders(user.id, 12),
    listActivity(user.id, 20),
    getSpendSummary(user.id),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-blueprint-light px-6 py-4">
        <Link href="/">
          <p className="font-tech text-xs tracking-widest text-cyan-accent">
            RENDERDROP
          </p>
          <p className="font-body text-xs text-graphite">Back to renders</p>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/renders"
            className="font-tech text-xs uppercase tracking-wide text-graphite transition-colors hover:text-cyan-accent"
          >
            My Renders
          </Link>
          <SignOutButton />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-linework">
          Your profile
        </h1>

        <ProfileForm
          email={user.email}
          displayName={profile?.display_name ?? ""}
          studioName={profile?.studio_name ?? ""}
        />

        <section className="mt-12">
          <h2 className="font-tech text-xs uppercase tracking-widest text-graphite">
            Recent renders
          </h2>

          {renders.length === 0 ? (
            <p className="mt-4 border border-blueprint-lighter bg-blueprint-light/40 px-4 py-8 text-center font-body text-sm text-graphite">
              No renders yet.{" "}
              <Link href="/" className="text-cyan-accent underline underline-offset-4">
                Upload a model
              </Link>{" "}
              to make your first one.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {renders.map((render) => (
                <li
                  key={render.id}
                  className="border border-blueprint-lighter bg-blueprint-light/40"
                >
                  {render.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={render.url}
                      alt="Render"
                      className="aspect-4/3 w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-4/3 w-full items-center justify-center font-tech text-xs text-graphite">
                      {render.status === "failed" ? "Failed" : "Processing"}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2 font-tech text-xs text-graphite">
                    <span>{render.resolution}</span>
                    <time dateTime={render.created_at}>
                      {new Date(render.created_at).toLocaleDateString()}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ActivityFeed activity={activity} spend={spend} />
      </main>
    </div>
  );
}

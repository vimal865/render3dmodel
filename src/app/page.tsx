import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { getRemainingRenders } from "@/lib/quota";
import UploadFlow from "@/components/UploadFlow";
import SignOutButton from "@/components/SignOutButton";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, remainingRenders] = await Promise.all([
    getProfile(user.id),
    getRemainingRenders(user.id),
  ]);
  const label = profile?.display_name || user.email;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-blueprint-light px-6 py-4">
        <div>
          <p className="font-tech text-xs tracking-widest text-cyan-accent">
            RENDERDROP
          </p>
          <p className="font-body text-xs text-graphite">{label}</p>
        </div>
        <nav className="flex items-center gap-5">
          <Link
            href="/renders"
            className="font-tech text-xs uppercase tracking-wide text-graphite transition-colors hover:text-cyan-accent"
          >
            My Renders
          </Link>
          <Link
            href="/profile"
            className="font-tech text-xs uppercase tracking-wide text-graphite transition-colors hover:text-cyan-accent"
          >
            Profile
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="flex-1 px-6 py-10">
        <UploadFlow remainingRenders={remainingRenders} />
      </main>
    </div>
  );
}

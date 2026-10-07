import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — RenderDrop",
};

const SUPPORT_EMAIL = "vimalrajelash@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-blueprint-light px-6 py-4">
        <Link href="/">
          <p className="font-tech text-xs tracking-widest text-cyan-accent">
            RENDERDROP
          </p>
          <p className="font-body text-xs text-graphite">Privacy Policy</p>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-linework">
          Privacy Policy
        </h1>
        <p className="mt-2 font-tech text-xs text-graphite">
          Last updated August 17, 2026
        </p>

        <p className="mt-6 border border-blueprint-lighter bg-blueprint-light/40 px-4 py-3 font-body text-sm text-graphite">
          This is a plain-language starting template, not a substitute for
          legal advice. Have it reviewed before relying on it for compliance.
        </p>

        <div className="mt-8 space-y-8 font-body text-sm leading-relaxed text-linework/90">
          <Section title="What we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li>Your email address, used for sign-in and account emails.</li>
              <li>
                Images you upload, the AI analysis generated from them
                (style, palette, scores), and the renders produced.
              </li>
              <li>
                Usage activity — actions like sign-in, uploads, and renders,
                each with a timestamp and, unless disabled by us, your IP
                address and browser user agent. This exists as a security
                audit trail and is visible to you on your profile page.
              </li>
            </ul>
          </Section>

          <Section title="Why we collect it">
            <p>
              To operate the render pipeline, enforce daily usage limits,
              investigate abuse or security incidents, and show you your own
              usage history.
            </p>
          </Section>

          <Section title="Third parties who process your data">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="text-linework">Supabase</span> — hosts our
                database, authentication, and file storage.
              </li>
              <li>
                <span className="text-linework">Google (Gemini API)</span> —
                every image you upload is sent to Google&rsquo;s Gemini API
                to generate the style analysis and the final render. Review
                Google&rsquo;s own terms for how they handle that data.
              </li>
            </ul>
          </Section>

          <Section title="How long we keep it">
            <p>
              Uploaded images, renders, and activity records are kept for as
              long as your account exists. If you ask us to delete your
              account, we delete the associated images and renders and
              anonymize your activity history rather than deleting it
              outright, so aggregate records aren&rsquo;t falsified.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can ask for a copy of your data or ask us to delete your
              account at any time by emailing{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-cyan-accent underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              . We handle these requests manually today and aim to respond
              within a few days. If you&rsquo;re in the EU or India, this is
              intended to satisfy your rights under the GDPR and the DPDP
              Act respectively — tell us which applies to you if it matters
              for how we handle the request.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use only the session cookie required to keep you signed in.
              No advertising or cross-site tracking cookies.
            </p>
          </Section>

          <Section title="Children">
            <p>This service is not directed at anyone under 18.</p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If this policy changes materially, we&rsquo;ll update the date
              at the top of this page.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy:{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-cyan-accent underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-tech text-xs uppercase tracking-widest text-graphite">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

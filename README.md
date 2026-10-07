# RenderDrop (clone) — core functionality build

Upload a SketchUp viewport export -> AI analyzes style/palette/scores ->
approve finishes -> photorealistic render. This is the core-functionality
slice only: no pricing, gallery, or social feed yet (see the project docs
for the phased plan).

Stack: Next.js 16 (App Router, TypeScript) + Supabase (Postgres, Auth,
Storage) + Gemini API (`gemini-3-flash-preview` for analysis,
`gemini-3-pro-image-preview` / Nano Banana Pro for rendering). No queue —
both AI calls run synchronously inside the request, comfortably inside
Vercel's function time limits.

## 1. Set up Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the Dashboard, go to **SQL Editor -> New query**, paste the contents
   of `supabase/schema.sql`, and run it. This creates the tables, the
   profile auto-create trigger, Row Level Security policies, and the two
   private storage buckets (`uploads`, `renders`).
3. Go to **Settings -> API** and copy:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY` (keep this secret —
     it's included for future admin-style operations but isn't required
     by the current code path)

### Configure email templates (required)

Supabase's default email templates don't point at this app's callback
route, so confirmation and password-reset links won't work until you
update them. Go to **Authentication -> Email Templates** and edit:

**Confirm signup** — replace the link URL with:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

**Reset password** — replace the link URL with:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

Then set **Authentication -> URL Configuration -> Site URL** to
`http://localhost:3000` for local development (change it to your real
domain when you deploy).

## 2. Get a Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com) -> **Get API
   key**.
2. You'll be asked to attach a Google Cloud billing account. This is
   required for image generation even at low volume — there's no way
   around it, budget ~$10-20 to build and test comfortably (see the cost
   estimate in the project docs: roughly $0.15-0.25 per render).
3. Copy the key into `GEMINI_API_KEY`.

## 3. Run it locally

```bash
cp .env.local.example .env.local
# fill in the four values above

npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login` first (Supabase
Auth, email + password). Sign up, confirm your email if required, then
you're in.

## How it works

```
Upload image
  -> POST /api/uploads
       - stores to Supabase Storage (uploads bucket)
       - calls Gemini (gemini-3-flash-preview) for style/palette/scores/caption
       - saves the analysis, returns it to the browser
Review & edit finishes
  -> POST /api/renders
       - calls Gemini (gemini-3-pro-image-preview / Nano Banana Pro),
         passing the ORIGINAL image + the approved style/finishes so the
         render preserves the uploaded geometry
       - stores the result to Supabase Storage (renders bucket)
       - returns a signed download URL
```

See `src/lib/render-service.ts` — that's the one file to change if you
later need to move either step behind an async queue instead of running
synchronously in the request.

## Routes

| Route | Purpose |
|---|---|
| `/login` | Sign in / sign up (email + password) |
| `/forgot-password` | Request a reset link |
| `/reset-password` | Set a new password (reached from the email link) |
| `/auth/confirm` | Exchanges an email token for a session |
| `/auth/error` | Shown for expired/invalid email links |
| `/` | Upload flow (auth required) |
| `/profile` | Display name, studio, recent renders (auth required) |
| `/api/uploads` | POST — store upload, run analysis |
| `/api/renders` | POST — generate render, return signed URL |
| `/api/profile` | GET / PATCH profile |
| `/api/renders/[id]/download` | GET — same-origin file download |
| `/api/activity` | POST — client-reported auth events (allow-listed) |

## Production hardening

The following are implemented and worth knowing about before you change
anything:

- **Session refresh** (`src/proxy.ts`) — refreshes the Supabase token on
  every request. Removing this causes users to be signed out at random.
- **Spend control** (`src/lib/quota.ts`) — a daily render cap plus a
  short-window burst limit. Configure with `DAILY_RENDER_LIMIT` and
  `DAILY_ANALYSIS_LIMIT`. Quota checks fail closed.
- **Retry and timeout** (`src/lib/gemini.ts`) — three attempts with
  exponential backoff, but only for transient failures (429, 5xx,
  network). Timeouts: 30s analysis, 90s render.
- **Activity log** (`src/lib/activity-log.ts`) — every transaction is
  recorded with duration, estimated cost, and outcome. Writes go through
  the service-role client and users have no insert/update/delete policy
  on the table, so the trail can't be edited by its subject. Client-side
  auth events are reported via `/api/activity`, which accepts only an
  allow-list of events and always takes user_id from the verified
  session — a client can't forge a `render.completed`.
  Visible to the user on `/profile`, with a spend summary.
  Set `LOG_IP_ADDRESSES=false` to stop collecting IPs (personal data
  under India's DPDP Act and the GDPR).
- **Downloads route through `/api/renders/[id]/download`** — the browser
  `download` attribute is ignored on cross-origin URLs, so linking
  directly to a Supabase signed URL opens the image instead of saving it.

## Known gaps (by design, for this slice)

- No pricing/credits — every signed-in user has unlimited renders right
  now. Add a `credits` column + check before charging real usage.
- No gallery/social feed.
- No email change or account deletion from the profile page.
- Gemini API errors surface as a plain error banner — no retry/backoff yet.
- This targets a fast-moving preview API (`gemini-3-pro-image-preview`).
  If a call starts failing, check https://ai.google.dev/gemini-api/docs
  first — model names and the image-output response shape are the most
  likely things to have shifted.

## Deploying later

Push to GitHub, import into Vercel, add the same four env vars in the
Vercel project settings. Then update **Supabase -> Authentication -> URL
Configuration -> Site URL** to your Vercel URL, or the email links will
still point at localhost. No code changes needed — Supabase and the
Gemini API are already reachable from anywhere.

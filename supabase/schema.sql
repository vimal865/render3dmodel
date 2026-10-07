-- RenderDrop-clone schema.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- against a fresh project. Safe to re-run: uses IF NOT EXISTS / ON CONFLICT
-- where practical, but table creation will error if the tables already
-- exist with a different shape -- this is meant for a first-time setup.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One profile row per auth user. Created automatically on signup by the
-- trigger at the bottom of this file, so the app can always assume it
-- exists rather than upserting defensively everywhere.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  studio_name text,
  created_at timestamptz not null default now()
);

create table if not exists uploads (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  status text not null default 'uploaded', -- uploaded | analyzed | failed
  created_at timestamptz not null default now()
);

-- Idempotent add for projects created before mime_type existed.
alter table uploads add column if not exists mime_type text;

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  style text not null,
  space_type text not null,
  scores jsonb not null,   -- { perspective, scale, layout, concept }
  palette jsonb not null,  -- [{ label, hex }, ...]
  caption text not null,
  created_at timestamptz not null default now()
);

create table if not exists renders (
  id uuid primary key,
  upload_id uuid not null references uploads(id) on delete cascade,
  finishes jsonb not null,      -- [{ label, hex }, ...] as approved by the user
  storage_path text,            -- null until generation completes
  resolution text not null default '2K', -- 1K | 2K | 4K
  status text not null default 'pending', -- pending | complete | failed
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_uploads_user_id on uploads(user_id);
create index if not exists idx_analyses_upload_id on analyses(upload_id);
create index if not exists idx_renders_upload_id on renders(upload_id);

-- Quota checks filter by user and a recent time window on every render
-- request. Without these the checks table-scan and get slower as usage
-- grows -- exactly when they matter most.
create index if not exists idx_uploads_user_created
  on uploads(user_id, created_at desc);
create index if not exists idx_renders_created
  on renders(created_at desc);
create index if not exists idx_renders_upload_created
  on renders(upload_id, created_at desc);

-- Immutable audit trail. Every transaction with a cost or a security
-- consequence lands here. Note there is deliberately no insert/update/
-- delete policy for regular users below -- only the service role (used
-- server-side) can write, so a user cannot edit their own history.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  status text not null default 'success', -- success | failure | denied
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  duration_ms integer,
  estimated_cost_usd numeric(10,5),
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- user_id is set null (not cascade) on account deletion so aggregate
-- spend history survives, while ceasing to identify a deleted person.

create index if not exists idx_activity_user_created
  on activity_log(user_id, created_at desc);
create index if not exists idx_activity_event
  on activity_log(event, created_at desc);
create index if not exists idx_activity_cost
  on activity_log(created_at desc) where estimated_cost_usd is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security -- each user can only ever see/touch their own rows.
-- analyses/renders don't store user_id directly; ownership is checked via
-- the parent upload, which does.
-- ---------------------------------------------------------------------------

alter table activity_log enable row level security;
alter table profiles enable row level security;
alter table uploads enable row level security;
alter table analyses enable row level security;
alter table renders enable row level security;

-- Read-only for the subject. No insert/update/delete policy exists by
-- design; writes go through the service role.
create policy "Users read their own activity"
  on activity_log for select
  using (auth.uid() = user_id);

create policy "Users read their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users manage their own uploads"
  on uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage analyses of their own uploads"
  on analyses for all
  using (
    exists (
      select 1 from uploads
      where uploads.id = analyses.upload_id and uploads.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from uploads
      where uploads.id = analyses.upload_id and uploads.user_id = auth.uid()
    )
  );

create policy "Users manage renders of their own uploads"
  on renders for all
  using (
    exists (
      select 1 from uploads
      where uploads.id = renders.upload_id and uploads.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from uploads
      where uploads.id = renders.upload_id and uploads.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage buckets -- private; the app fetches contents as the signed-in
-- user (uploads) or via a short-lived signed URL (renders, for download).
-- Objects are stored as "{user_id}/{uuid}.{ext}", which is what the
-- policies below check against.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

create policy "Users upload their own files (uploads bucket)"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read their own files (uploads bucket)"
  on storage.objects for select
  using (
    bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload their own files (renders bucket)"
  on storage.objects for insert
  with check (
    bucket_id = 'renders' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read their own files (renders bucket)"
  on storage.objects for select
  using (
    bucket_id = 'renders' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- security definer is required: the trigger runs as the auth system, which
-- otherwise has no rights to insert into a table with RLS enabled.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for any users created before this trigger existed.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

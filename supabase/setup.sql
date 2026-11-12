-- AuraSound Supabase setup
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- The app uses the public publishable key; these policies protect every user's data.

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Users can read own AuraSound state" on public.app_state;
create policy "Users can read own AuraSound state"
on public.app_state for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own AuraSound state" on public.app_state;
create policy "Users can insert own AuraSound state"
on public.app_state for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own AuraSound state" on public.app_state;
create policy "Users can update own AuraSound state"
on public.app_state for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.tracks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique,
  name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  last_modified bigint not null default 0,
  album text not null default '',
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

drop policy if exists "Users can read own AuraSound tracks" on public.tracks;
create policy "Users can read own AuraSound tracks"
on public.tracks for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own AuraSound tracks" on public.tracks;
create policy "Users can insert own AuraSound tracks"
on public.tracks for insert to authenticated
with check (auth.uid() = user_id and split_part(storage_path, '/', 1) = auth.uid()::text);

drop policy if exists "Users can delete own AuraSound tracks" on public.tracks;
create policy "Users can delete own AuraSound tracks"
on public.tracks for delete to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aurasound-tracks', 'aurasound-tracks', false, 104857600, null)
on conflict (id) do update set public = false, file_size_limit = 104857600;

drop policy if exists "Users can upload own AuraSound audio" on storage.objects;
create policy "Users can upload own AuraSound audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'aurasound-tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own AuraSound audio" on storage.objects;
create policy "Users can read own AuraSound audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'aurasound-tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own AuraSound audio" on storage.objects;
create policy "Users can delete own AuraSound audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'aurasound-tracks'
  and (storage.foldername(name))[1] = auth.uid()::text
);

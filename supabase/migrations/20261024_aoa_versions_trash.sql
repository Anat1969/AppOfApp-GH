-- APPOFAPP-GH: undo for edits and deletes. Applied 2026-10-24.
create table public.aoa_app_versions (
  id bigserial primary key,
  app_id text not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index aoa_app_versions_app on public.aoa_app_versions (app_id, saved_at desc);
create table public.aoa_trash (
  app_id text primary key,
  data jsonb not null,
  deleted_at timestamptz not null default now()
);
alter table public.aoa_app_versions enable row level security;
alter table public.aoa_trash enable row level security;
create policy aoa_app_versions_public_read on public.aoa_app_versions for select using (true);
create policy aoa_trash_public_read on public.aoa_trash for select using (true);

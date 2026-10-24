-- APPOFAPP-GH on cultura-GH (ktqmwpbzcnzkhjskqisy). Applied 2026-10-24.
create table public.aoa_apps (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.aoa_categories (
  value text primary key,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table public.aoa_editor_keys (key_hash text primary key, label text, created_at timestamptz not null default now());
create table public.aoa_admins (email text primary key, created_at timestamptz not null default now());

alter table public.aoa_apps enable row level security;
alter table public.aoa_categories enable row level security;
alter table public.aoa_editor_keys enable row level security;
alter table public.aoa_admins enable row level security;

-- Public read; no write policies: every write goes through the aoa-edit function (service role).
create policy aoa_apps_public_read on public.aoa_apps for select using (true);
create policy aoa_categories_public_read on public.aoa_categories for select using (true);

insert into storage.buckets (id, name, public) values ('aoa-media', 'aoa-media', true) on conflict (id) do nothing;

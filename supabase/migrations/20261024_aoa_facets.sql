-- APPOFAPP-GH: controlled vocabulary for domains and contexts. Applied 2026-10-24.
create table public.aoa_facets (
  kind text not null check (kind in ('domain','context')),
  value text not null,
  label text not null,
  synonyms text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (kind, value)
);
alter table public.aoa_facets enable row level security;
create policy aoa_facets_public_read on public.aoa_facets for select using (true);
-- Seed: 11 domains (urban, municipal, architecture, sustainability, data, psychology, education, culture,
-- math, ai, personal) and 5 contexts (work, professional, public, teaching, personal), each with synonyms.

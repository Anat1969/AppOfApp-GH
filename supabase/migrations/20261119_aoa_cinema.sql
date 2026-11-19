-- The cinema (Anat, 2026-11-19): every film of every app in one hall, read live from storage, so a new film joins
-- the list the moment its file exists. Nothing is copied: the feed points at the files where the apps keep them.

-- Which app a bucket's films belong to. aoa-media is by folder (<appId>/...), so it needs no app here.
create table if not exists aoa_video_sources (
  bucket text primary key,
  app_id text
);
insert into aoa_video_sources (bucket, app_id) values
  ('aoa-media', null),
  ('mo-media', 'app-1794150000000'),
  ('article-media', 'app-1790184829249'),
  ('neo-gallery-images', 'app-1774953289593'),
  ('taarucha-media', 'app-1791677991497'),
  ('mathcreator-library', 'app-1775918508553')
on conflict (bucket) do nothing;

-- What Anat sets by hand on a film (title, subject, app, hidden, opening film), and films added by link (url set).
create table if not exists aoa_videos (
  key text primary key,
  title text,
  note text,
  app_id text,
  domains text[],
  kind text check (kind in ('demo', 'creation')),
  hidden boolean not null default false,
  featured boolean not null default false,
  url text,
  poster text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table aoa_video_sources enable row level security;
alter table aoa_videos enable row level security;
drop policy if exists aoa_video_sources_read on aoa_video_sources;
create policy aoa_video_sources_read on aoa_video_sources for select using (true);
drop policy if exists aoa_videos_read on aoa_videos;
create policy aoa_videos_read on aoa_videos for select using (true);

create or replace function aoa_cinema() returns jsonb
language sql stable security definer set search_path = public, storage as $$
with base as (select 'https://ktqmwpbzcnzkhjskqisy.supabase.co/storage/v1/object/public/' as pub),
files as (
  select o.bucket_id as bucket, o.name, o.created_at, (o.metadata->>'size')::bigint as size, b.public,
         case when b.public then (select pub from base) || o.bucket_id || '/' || o.name end as url,
         case when o.bucket_id = 'aoa-media' then split_part(o.name, '/', 1) else s.app_id end as app_id,
         case when o.bucket_id = 'aoa-media' and split_part(o.name, '/', 2) like 'demo-%' then 'demo' else 'creation' end as kind
  from storage.objects o
  join storage.buckets b on b.id = o.bucket_id
  left join aoa_video_sources s on s.bucket = o.bucket_id
  where o.metadata->>'mimetype' like 'video/%'
),
named as (
  select f.bucket || '/' || f.name as key, f.bucket, f.url, f.app_id, f.kind, f.created_at, f.size, not f.public as private,
         -- an older take of a demo video: kept in storage, not screened
         (f.kind = 'demo' and coalesce(a.data->'demo'->>'src', '') <> coalesce(f.url, '-')) as old,
         case
           when f.bucket = 'mo-media' then mc.name || coalesce(' · מראה ' || substring(split_part(f.name, '/', 3) from '^l(\d+)'), '')
           when f.bucket = 'article-media' then ca.concept || ': ' || ca.space_name || case when f.name like '%interior%' then ' · פנים' else ' · חוץ' end
           when f.bucket = 'neo-gallery-images' and na.title !~ '^anatsht' and na.title <> '' then na.title
           when f.bucket = 'taarucha-media' then coalesce(nullif(tw.title, ''), te.title)
         end as title,
         case
           when f.kind = 'demo' then a.data->'demo'->>'poster'
           when f.bucket = 'article-media' then case when f.name like '%interior%' then ca.image_interior else ca.image_exterior end
           when f.bucket = 'neo-gallery-images' then na.image_url
           when f.bucket = 'taarucha-media' and te.cover_url like 'http%' then te.cover_url
         end as poster,
         case when f.kind = 'demo' then (a.data->'demo'->>'duration')::numeric end as duration
  from files f
  left join aoa_apps a on a.id = f.app_id
  left join mo_collections mc on f.bucket = 'mo-media' and mc.id::text = split_part(f.name, '/', 2)
  left join culture_articles ca on f.bucket = 'article-media' and ca.id::text = split_part(f.name, '/', 1)
  left join lateral (select title, image_url from neo_artworks n where f.bucket = 'neo-gallery-images' and n.media_url = f.url limit 1) na on true
  left join lateral (select title from taarucha_works w where f.bucket = 'taarucha-media' and f.url in (w.media_url, w.video_url) limit 1) tw on true
  left join taarucha_exhibitions te on f.bucket = 'taarucha-media' and 'ex-' || te.id::text = split_part(f.name, '/', 1)
  union all
  -- a demo video that lives on the app's own site, not in storage
  select 'demo:' || a.id, null, a.data->'demo'->>'src', a.id, 'demo',
         coalesce(nullif(a.data->'demo'->>'updatedAt', '')::timestamptz, a.updated_at), null, false, false, null,
         a.data->'demo'->>'poster', (a.data->'demo'->>'duration')::numeric
  from aoa_apps a
  where coalesce(a.data->'demo'->>'src', '') <> '' and a.data->'demo'->>'src' not like (select pub from base) || '%'
  union all
  -- a film added by link
  select v.key, null, v.url, v.app_id, coalesce(v.kind, 'creation'), v.created_at, null, false, false, null, v.poster, null
  from aoa_videos v where v.url is not null
)
select coalesce(jsonb_agg(jsonb_build_object(
  'key', n.key, 'bucket', n.bucket, 'url', n.url, 'private', n.private, 'old', n.old,
  'app_id', coalesce(v.app_id, n.app_id), 'kind', coalesce(v.kind, n.kind),
  'title', coalesce(nullif(v.title, ''), n.title), 'named', v.title is not null and v.title <> '',
  'note', v.note, 'domains', v.domains, 'hidden', coalesce(v.hidden, false), 'featured', coalesce(v.featured, false),
  'poster', coalesce(v.poster, n.poster), 'duration', n.duration, 'size', n.size, 'created_at', n.created_at
) order by n.created_at desc), '[]'::jsonb)
from named n left join aoa_videos v on v.key = n.key;
$$;

-- Editing is open on every device (Anat, 2026-10-29), so the two writes are open too; they touch only aoa_videos.
create or replace function aoa_video_save(p_key text, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key is null or length(p_key) < 3 or length(p_key) > 400 then raise exception 'bad key'; end if;
  insert into aoa_videos (key) values (p_key) on conflict (key) do nothing;
  update aoa_videos set
    title = case when p ? 'title' then left(p->>'title', 200) else title end,
    note = case when p ? 'note' then left(p->>'note', 600) else note end,
    app_id = case when p ? 'app_id' then nullif(left(p->>'app_id', 80), '') else app_id end,
    domains = case when p ? 'domains' then (select array_agg(left(x, 60)) from jsonb_array_elements_text(p->'domains') x) else domains end,
    kind = case when p ? 'kind' and p->>'kind' in ('demo', 'creation') then p->>'kind' else kind end,
    hidden = case when p ? 'hidden' then (p->>'hidden')::boolean else hidden end,
    featured = case when p ? 'featured' then (p->>'featured')::boolean else featured end,
    url = case when p_key like 'link:%' and p ? 'url' and p->>'url' ~ '^https://' then left(p->>'url', 600) else url end,
    poster = case when p ? 'poster' and (p->>'poster' ~ '^https://' or p->>'poster' = '') then nullif(left(p->>'poster', 600), '') else poster end,
    updated_at = now()
  where key = p_key;
end $$;

-- Removes a film added by link; for a file in storage it only clears what was set by hand (the file stays).
create or replace function aoa_video_delete(p_key text) returns void
language sql security definer set search_path = public as $$
  delete from aoa_videos where key = p_key;
$$;

revoke all on function aoa_cinema(), aoa_video_save(text, jsonb), aoa_video_delete(text) from public;
grant execute on function aoa_cinema(), aoa_video_save(text, jsonb), aoa_video_delete(text) to anon, authenticated, service_role;

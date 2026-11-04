-- Domains shown in English in the table (Anat, 2026-11-04: "לא לכתוב באנגלית פרמטרים של תחום"): five domain values
-- were saved on apps without a vocabulary entry, so the raw value was shown. Two become new Hebrew domains; the rest join
-- existing ones: thinking models (strategy, planning) go to psychology, receipts (tools) to personal. "tools" is not a category ("כלי" is a synonym of diagnose and create) and is dropped.
insert into aoa_facets (kind, value, label, synonyms, position) values
  ('domain', 'health', 'בריאות וגוף', array['בריאות','רפואה','גוף','תזונה','health'], 11),
  ('domain', 'knowledge', 'ידע ורעיונות', array['ידע','רעיונות','אמירות','ציטוטים','knowledge'], 12)
on conflict do nothing;

-- keep the previous version of every app that changes (same safety net as aoa-edit)
insert into aoa_app_versions (app_id, data, saved_at)
select id, data, now() from aoa_apps where data->'domains' ?| array['strategy','planning','tools'];

update aoa_apps set data = jsonb_set(data, '{domains}', (
  select coalesce(jsonb_agg(distinct m), '[]'::jsonb) from (
    select case v when 'strategy' then 'psychology' when 'planning' then 'psychology' when 'tools' then 'personal' else v end m
    from jsonb_array_elements_text(data->'domains') v
  ) x
)), updated_at = now()
where data->'domains' ?| array['strategy','planning','tools'];

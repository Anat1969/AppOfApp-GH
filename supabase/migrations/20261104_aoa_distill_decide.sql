-- New columns זיקוק (distill) and החלטה (decide) (Anat, 2026-11-04: "כן תעביר"). Previous versions kept in aoa_app_versions.
insert into aoa_app_versions (app_id, data, saved_at)
select id, data, now() from aoa_apps where id in ('app-1792268765635','app-1775503887274','app-1775492522623','app-1793628300000','app-1792268830987','app-1793584600000','app-1793788999439','app-1774954138281','app-1791738683589','app-1776424435731');
update aoa_apps set data = jsonb_set(data, '{action}', to_jsonb(case when id in ('app-1792268765635','app-1775503887274','app-1775492522623','app-1793628300000','app-1792268830987') then 'distill' else 'decide' end)), updated_at = now()
where id in ('app-1792268765635','app-1775503887274','app-1775492522623','app-1793628300000','app-1792268830987','app-1793584600000','app-1793788999439','app-1774954138281','app-1791738683589','app-1776424435731');
-- distill: זיקוק DNA, מיקוד, מגזין מהות, מזון גוף ונפש, רדאר אקטואליה. decide: מתאם מודלים, מחולל חלופות בינוי, פינוי בינוי, ביניינית, כובעי חשיבה.

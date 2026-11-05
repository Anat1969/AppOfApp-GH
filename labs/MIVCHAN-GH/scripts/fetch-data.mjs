// Pulls the data from its single sources at build time, so the app always ships the current archive.
// usage: node scripts/fetch-data.mjs olam amirot aoa   (any subset)
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { transform } from 'esbuild';
const RAW = 'https://raw.githubusercontent.com/Anat1969';
const OUT = new URL('../src/data/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const get = async (u, as = 'json') => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return as === 'json' ? r.json() : r.text(); };
const save = (name, data) => { writeFileSync(new URL(name, OUT), JSON.stringify(data)); console.log('data:', name); };

async function olam() {
  const [D, P, S, F] = await Promise.all(['discoveries', 'persons', 'sources', 'fields'].map((f) => get(`${RAW}/Olam-GH/main/data/${f}.json`)));
  const pm = Object.fromEntries(P.persons.map((p) => [p.id, p])), sm = Object.fromEntries(S.sources.map((s) => [s.id, s]));
  const domains = F.families.flatMap((fa) => fa.domains.map((d) => ({ id: d.id, he: d.nameHe, en: d.nameFull, family: fa.id, familyHe: fa.nameHe, color: fa.color, subs: d.subs.map((s) => ({ id: s.id, he: s.nameHe })) })));
  const discoveries = D.discoveries.filter((x) => x.verified).map((x) => {
    const ev = (x.evidence || [])[0] || {}; const src = sm[ev.sourceId || x.sources[0]] || {};
    const pl = x.place || null;
    return { id: x.id, t: x.title, y: x.yearFrom, y2: x.yearTo ?? null, ya: !!x.yearApprox, dm: x.domainId, sub: x.sub,
      who: x.personIds.map((i) => pm[i]).filter(Boolean).map((p) => ({ he: p.nameHe || p.nameHeTranslit || p.nameFull, en: p.nameFull })),
      city: pl && pl.city ? { he: pl.city.nameHe, en: pl.city.nameFull } : pl && pl.nameHe ? { he: pl.nameHe, en: pl.nameFull } : null,
      nov: x.novelty || '', con: x.contribution || '', q: ev.quoteHe || '', qo: ev.quote || '', src: { t: src.title || '', u: src.url || '' }, conf: x.confidence };
  });
  return { domains, discoveries };
}
async function tsModule(path) {
  const { code } = await transform(await get(`${RAW}/Amirot-GH/main/${path}`, 'text'), { loader: 'ts', format: 'esm' });
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
async function amirot() {
  const [{ SAYINGS }, { IDEAS }] = await Promise.all([tsModule('src/data/sayings.ts'), tsModule('src/data/ideas.ts')]);
  return { ideas: IDEAS.map((i) => ({ id: i.id, chip: i.chip, q: i.q, a: i.a, b: i.b })), sayings: SAYINGS.map((s) => ({ id: s.id, idea: s.idea, side: s.side, he: s.he, orig: s.orig, culture: s.culture, src: s.src, year: s.year })) };
}
async function aoa() {
  const K = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
  const r = await fetch('https://ktqmwpbzcnzkhjskqisy.supabase.co/rest/v1/aoa_apps?select=id,data', { headers: { apikey: K, Authorization: `Bearer ${K}` } });
  if (!r.ok) throw new Error('aoa ' + r.status);
  const arr = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()) : null);
  return (await r.json()).map(({ id, data: d }) => ({ id, n: d.name || '', on: d.originalName || null, a: d.action || null, d: arr(d.domains), k: arr(d.keywords), c: arr(d.concepts), t: String(d.desc || '').slice(0, 160), u: d.previewUrl || d.websiteUrl || null }));
}

const o = want.has('olam') || want.has('olam-lite') || want.has('archive') ? await olam() : null;
if (want.has('olam')) save('olam.json', o);
if (want.has('olam-lite')) save('olam-lite.json', { domains: o.domains, discoveries: o.discoveries.map((d) => ({ id: d.id, t: d.t, y: d.y, dm: d.dm, sub: d.sub, who: d.who.map((w) => w.he), nov: d.nov, src: d.src })) });
if (want.has('archive')) {
  const a = await amirot();
  const { TESTS_IDS } = await import(new URL('./test-ids.mjs', import.meta.url));
  save('archive.json', { domains: o.domains.map((d) => ({ id: d.id, he: d.he, color: d.color })), discoveries: o.discoveries.filter((d) => TESTS_IDS.includes(d.id)), ideas: a.ideas, sayings: a.sayings });
}
if (want.has('aoa')) {
  try { save('apps-snapshot.json', await aoa()); }
  catch (e) { console.warn('aoa snapshot skipped:', e.message); if (!existsSync(new URL('apps-snapshot.json', OUT))) save('apps-snapshot.json', []); }
}

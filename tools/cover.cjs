// The app's home page as its cover in the portfolio (Anat, 2026-11-11: "אתה שומר את הדף הראשי בתוך חלון מסגרת תמונה של
// האפליקציה כדי שאני לא אצטרך לבצע פעולה זו באופן ידני של חיתוך והדבקה").
//
//   node tools/cover.cjs <appId> [<appId> ...]     the named apps (replaces an existing cover only with --force)
//   node tools/cover.cjs --missing                 every app that has a site and no cover
//   node tools/cover.cjs --missing --dry out/      only write the pictures to a folder, save nothing
//
// A real browser opens the app's own address at 1280x800, waits for the content and the fonts, and takes one picture of
// the first screen. The picture goes to aoa-media/<appId>/cover-<ts>.jpg (sign_upload) and into data.coverImage
// (save_app), with data.coverAuto = true so the portfolio knows it was not chosen by hand. updatedAt is left alone:
// that date is the day Anat last changed the app.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SB = 'https://ktqmwpbzcnzkhjskqisy.supabase.co';
const KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
const BUCKET = 'aoa-media';
const W = 1280, H = 800;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const dryAt = args.indexOf('--dry');
const dry = dryAt >= 0 ? args[dryAt + 1] : '';
const ids = args.filter((a, i) => !a.startsWith('--') && !(dryAt >= 0 && i === dryAt + 1));

const withProtocol = (u) => (/^[a-z][a-z\d+.-]*:/i.test(u) ? u : `https://${u}`);
/** Same rule as siteUrl() in src/lib/format.ts: the public app address, never an editor page. */
function siteUrl(app) {
  const list = [app.previewUrl, app.websiteUrl, app.editUrl];
  for (let i = 0; i < list.length; i++) {
    const t = (list[i] ?? '').trim();
    if (!t) continue;
    try {
      const u = new URL(withProtocol(t));
      if (!['http:', 'https:'].includes(u.protocol) || u.hostname === 'localhost') continue;
      if (i === 2 && !['.base44.app', '.lovable.app', '.github.io', '.vercel.app'].some((d) => u.hostname.endsWith(d))) continue;
      return u.href;
    } catch { continue; }
  }
  return '';
}

const edit = async (action, payload) => {
  const r = await fetch(`${SB}/functions/v1/aoa-edit`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY }, body: JSON.stringify({ action, ...payload }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `aoa-edit ${r.status}`);
  return d;
};
const rows = async (q) => (await fetch(`${SB}/rest/v1/aoa_apps?select=id,data${q}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } })).json();

(async () => {
  if (!ids.length && !flag('--missing')) { console.error('usage: node tools/cover.cjs <appId>... | --missing [--force] [--dry <dir>]'); process.exit(2); }
  const all = await rows(ids.length ? `&id=in.(${ids.map(encodeURIComponent).join(',')})` : '');
  const todo = all.filter((r) => siteUrl(r.data) && (flag('--force') || !r.data.coverImage));
  for (const r of all) if (!todo.includes(r) && (ids.length || !r.data.coverImage)) console.log(`skip  ${r.id}  ${r.data.name}: ${siteUrl(r.data) ? 'has a cover (use --force)' : 'no public address'}`);
  if (dry) fs.mkdirSync(dry, { recursive: true });

  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let ok = 0;
  for (const r of todo) {
    const site = siteUrl(r.data);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: 'he-IL', deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    try {
      const res = await p.goto(site, { waitUntil: 'load', timeout: 45000 });
      if (res && res.status() >= 400) throw new Error(`the site answered ${res.status()}`);
      await p.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      // A sign-in page of the hosting service is not the app's home page.
      if (new URL(p.url()).hostname !== new URL(site).hostname) throw new Error(`the address moved to ${new URL(p.url()).hostname}`);
      await p.waitForTimeout(1500);
      // An empty page is not a cover: a blank picture would hide the fact that the app has none.
      const text = await p.evaluate(() => (document.body.innerText || '').trim().length + document.querySelectorAll('img,canvas,svg,video').length);
      if (!text) throw new Error('the page is empty');
      // Entrance animations and late data: the picture is taken when two frames a second apart are the same (12s at most).
      let shot = await p.screenshot({ type: 'jpeg', quality: 86 });
      for (let i = 0; i < 12; i++) {
        await p.waitForTimeout(1000);
        const next = await p.screenshot({ type: 'jpeg', quality: 86 });
        const same = next.equals(shot);
        shot = next;
        if (same) break;
      }
      if (dry) {
        fs.writeFileSync(path.join(dry, `${r.id}.jpg`), shot);
      } else {
        const file = `${r.id.replace(/[^\w-]/g, '')}/cover-${Date.now()}.jpg`;
        const { token, publicUrl } = await edit('sign_upload', { path: file });
        const up = await fetch(`${SB}/storage/v1/object/upload/sign/${BUCKET}/${file}?token=${token}`, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg', apikey: KEY }, body: shot });
        if (!up.ok) throw new Error(`upload ${up.status}`);
        // Read again right before saving, so an edit made in the meantime is not overwritten.
        const [fresh] = await rows(`&id=eq.${encodeURIComponent(r.id)}`);
        await edit('save_app', { id: r.id, data: { ...fresh.data, coverImage: publicUrl, coverAuto: true } });
      }
      ok++;
      console.log(`cover ${r.id}  ${r.data.name}  ${site}`);
    } catch (e) {
      console.log(`fail  ${r.id}  ${r.data.name}  ${site}: ${String(e.message || e).split('\n')[0]}`);
    }
    await ctx.close();
  }
  await b.close();
  console.log(`${ok} of ${todo.length} covers ${dry ? 'written to ' + dry : 'saved'}`);
})();

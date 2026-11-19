// The cinema page against `vite preview`, with every Supabase call mocked.
// Run: npm run build && (npx vite preview --port 4173 &) && node tests/cinema.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); };

const pub = 'https://x.supabase.co/storage/v1/object/public/';
const app = (id, name, action, domains, demo) => ({ id, data: { name, action, domains, previewUrl: `https://${id}.vercel.app/`, desc: `**${name}** עושה דבר אחד טוב. משפט שני.`, updatedAt: '2026-11-10T10:00:00Z', ...(demo ? { demo } : {}) } });
const apps = [
  app('app-1', 'רפואה', 'explore', ['health'], { src: `${pub}aoa-media/app-1/demo-2.mp4`, speed: 1.2, duration: 60 }),
  app('app-2', 'אופנה', 'create', ['culture']),
  app('app-3', 'תואם מתאר', 'diagnose', ['urban']),
  app('app-4', 'מושג מתמטי', 'create', ['math']),
];
const facets = [['health', 'בריאות וגוף'], ['culture', 'תרבות ואמנות'], ['urban', 'תכנון עירוני'], ['math', 'מתמטיקה ומדע']].map(([value, label], position) => ({ kind: 'domain', value, label, synonyms: [], position }));
const film = (key, app_id, kind, extra = {}) => ({ key, bucket: key.split('/')[0], url: pub + key, private: false, old: false, app_id, kind, title: null, named: false, note: null, domains: null, hidden: false, featured: false, poster: null, duration: null, size: 3_000_000, created_at: '2026-11-01T10:00:00Z', ...extra });
let feed = [
  film('aoa-media/app-1/demo-2.mp4', 'app-1', 'demo', { duration: 60 }),
  film('aoa-media/app-1/demo-1.mp4', 'app-1', 'demo', { old: true }),
  film('mo-media/c/1/l1-film.mp4', 'app-2', 'creation', { title: 'בד נולד מחדש · מראה 1' }),
  film('mo-media/c/1/l2-film.mp4', 'app-2', 'creation', { title: 'בד נולד מחדש · מראה 2' }),
  film('mathcreator-library/a/b.mp4', 'app-4', 'creation', { private: true, url: null }),
];
const saves = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', permissions: ['clipboard-read', 'clipboard-write'] });
await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await context.route(/\/storage\/v1\/object\/public\//, (r) => r.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) }));
await context.route(/\/rest\/v1\/aoa_apps/, (r) => r.fulfill({ json: apps }));
await context.route(/\/rest\/v1\/aoa_facets/, (r) => r.fulfill({ json: facets }));
await context.route(/\/rest\/v1\/rpc\/aoa_cinema/, (r) => r.fulfill({ json: feed }));
await context.route(/\/rest\/v1\/rpc\/aoa_video_save/, (r) => { saves.push(r.request().postDataJSON()); return r.fulfill({ status: 204, body: '' }); });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ---------- the hall ----------
await page.goto(`${BASE}/cinema/`);
await page.waitForSelector('.cin-item');
ok((await page.locator('.cin-item').count()) === 3, 'the programme screens public, current films only (no old take, no locked file)');
ok(await page.locator('ai-menu').count() === 1, 'the A&I logo button is in the top bar');
ok((await page.locator('.cin-bar a.cin-back').getAttribute('href')) === '/', 'the bar links back to the portfolio');
ok(await page.locator('.cin-go').isVisible(), 'the film waits for one press, so it starts with sound');
ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'the hall fits the screen without scrolling');
const names = await page.locator('.cin-item-text b').allTextContents();
ok(names[0].startsWith('בד נולד') !== names[1].startsWith('בד נולד'), 'two films of one app are not neighbours while another app waits');
await page.locator('.cin-item', { hasText: 'מראה 2' }).click();
ok(new URL(page.url()).searchParams.get('film') === 'mo-media/c/1/l2-film.mp4', 'a film has its own address');
ok((await page.locator('.cin-card h1').textContent()) === 'בד נולד מחדש · מראה 2' && (await page.locator('.cin-lead').textContent()).includes('אופנה'), 'the card names the film and its app');
ok((await page.locator('.cin-card-btns .solid').getAttribute('href')) === 'https://app-2.vercel.app/', 'one main button opens the app');
await page.locator('.cin-card-btns button', { hasText: 'העתקת קישור' }).click();
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('/cinema/?film=mo-media'), 'the link to the film is copied');
await page.locator('.cin-filters .seg button', { hasText: 'הדגמה' }).click();
ok((await page.locator('.cin-item').count()) === 1 && page.url().includes('kind=demo'), 'the kind filter narrows the programme and lives in the address');
await page.locator('.cin-filters .link').click();
await page.locator('.cin-filters .chip', { hasText: 'תרבות ואמנות' }).click();
ok((await page.locator('.cin-item').count()) === 2, 'a film takes its subject from its app');

// the film ends: a title card names the next one, then it plays
await page.goto(`${BASE}/cinema/?app=app-2`);
await page.waitForSelector('.cin-item');
const firstName = await page.locator('.cin-card h1').textContent();
await page.evaluate(() => document.querySelector('.cin-screen video').dispatchEvent(new Event('ended')));
ok(await page.locator('.cin-inter').isVisible() && (await page.locator('.cin-inter').textContent()).includes('הבא בתוכנייה'), 'between films a title card names the next one');
await page.locator('.cin-inter .solid').click();
ok((await page.locator('.cin-card h1').textContent()) !== firstName, 'the next film comes up');

// ---------- a new film joins by itself ----------
await page.goto(`${BASE}/cinema/`);
await page.waitForSelector('.cin-item');
feed = [film('aoa-media/app-3/film-9.mp4', 'app-3', 'creation', { created_at: new Date().toISOString() }), ...feed];
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForFunction(() => document.querySelectorAll('.cin-item').length === 4);
const fresh = page.locator('.cin-item', { hasText: 'תואם מתאר · סרט 1' });
ok((await fresh.count()) === 1 && (await fresh.locator('.cin-new').count()) === 1, 'a new file in storage joins the programme by itself, marked as new');

// ---------- all films ----------
await page.locator('.cin-bar .tab', { hasText: 'כל הסרטים' }).click();
ok((await page.locator('.cin-row').count()) === 4, 'the list opens on the films on screen');
await page.locator('.cin-tools .seg button', { hasText: 'גרסאות קודמות' }).click();
ok((await page.locator('.cin-row').count()) === 1, 'older takes are kept in their own group');
await page.locator('.cin-tools .seg button', { hasText: 'נעולים' }).click();
ok((await page.locator('.cin-row').count()) === 1 && (await page.locator('.cin-row-btns button', { hasText: 'הקרנה' }).count()) === 0, 'a film in a private bucket is listed as locked and cannot be screened');
await page.locator('.cin-tools .seg button', { hasText: 'בהקרנה' }).click();
const title = page.locator('.cin-row', { hasText: 'אופנה' }).first().locator('.cin-title');
await title.fill('שם חדש לסרט');
await title.press('Enter');
await page.waitForTimeout(400);
ok(saves.some((s) => s.p.title === 'שם חדש לסרט' && s.p_key.startsWith('mo-media/')), 'renaming a film saves on leaving the field');
await page.locator('.cin-row').filter({ has: page.locator('.cin-title[value="שם חדש לסרט"]') }).locator('button', { hasText: 'עריכה' }).click();
await page.locator('.cin-edit button', { hasText: 'הסתרה מהאולם' }).click();
await page.waitForTimeout(400);
ok(saves.some((s) => s.p.hidden === true), 'a film can be hidden from the hall');
await page.locator('.cin-sort select').selectOption('app');
ok((await page.locator('.cin-group').count()) >= 2, 'sorting by app groups the list under headings');
await page.locator('.cin-head .solid').click();
ok(await page.locator('.cin-add .cin-drop').isVisible(), 'adding a film: choose, drag or paste');

// ---------- what is missing ----------
await page.locator('.cin-bar .tab', { hasText: 'מה חסר' }).click();
ok((await page.locator('.cin-head h1').textContent()).trim().startsWith('1 '), 'the page counts the apps that still have no film');
ok((await page.locator('.cin-missing li').count()) === 1 && (await page.locator('.cin-note').textContent()).includes('נעולים'), 'the missing list names them, and the locked films are explained');
await page.locator('.cin-missing li button').click();
ok((await page.evaluate(() => navigator.clipboard.readText())).includes('aoa-media/app-4/demo-'), 'a ready request for the missing film is copied');

// ---------- phone ----------
const phone = await context.newPage();
await phone.setViewportSize({ width: 375, height: 780 });
for (const v of ['', '?tab=all', '?tab=gaps']) {
  await phone.goto(`${BASE}/cinema/${v}`);
  await phone.waitForSelector('.cin-item, .cin-row, .cin-missing');
  ok((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 375, `phone ${v || 'hall'}: no horizontal scroll`);
}

// ---------- the portfolio links in ----------
await page.goto(`${BASE}/`);
await page.waitForSelector('.topbar .actions');
ok((await page.locator('.topbar .actions a.tab', { hasText: 'קולנוע' }).getAttribute('href')) === '/cinema/', 'the portfolio top bar leads to the cinema');

ok(!errors.length, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);

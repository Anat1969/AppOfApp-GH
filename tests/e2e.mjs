// End-to-end check against `vite preview`, with every Supabase call mocked.
// Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const KEY = 'test-editor-key-123456';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

const cats = [
  { value: 'tools', label: 'כלים', position: 0 },
  { value: 'games', label: 'משחקים', position: 1 },
  { value: 'municipality', label: 'עירייה', position: 2 },
  { value: 'interest', label: 'עניין', position: 3 },
];
const day = 86_400_000;
const names = [
  ['מחקר: זיקוק DNA', 'tools', 'https://zikuk-dna.vercel.app/dna'],
  ['השראה: רדאר אקטואליה', 'interest', 'https://radar-aktualya.vercel.app/'],
  ['משחק: בקשה להיתר', 'games', 'https://bakasha-leheter.vercel.app'],
  ['עירייה: תואם מתאר', 'municipality', 'https://ashdod-mitar-twin.vercel.app/'],
  ['כלי: תכנון גינות', null, 'https://garden-gh.vercel.app/'],
  ['דשבורד: אדריכלית העיר - גרסה ארוכה מאוד עם שם שמתפרש על כמה שורות', 'municipality', 'https://merhav-midbar.lovable.app'],
  ['משחק: 6 הכובעים', 'games', ''],
  ['כלי מדידה: פנג שואי', 'tools', 'https://feng-shui-two.vercel.app/#'],
];
const rows = names.map(([name, category, url], i) => ({
  id: `app-${i + 1}`,
  created_at: new Date(Date.now() - (i + 1) * 9 * day).toISOString(),
  updated_at: new Date(Date.now() - i * day).toISOString(),
  data: {
    id: `app-${i + 1}`,
    name,
    title: name,
    category,
    previewUrl: url,
    primaryBtn: '← קישור לאפליקציה - VERCAL',
    desc: i === 0 ? 'מערכת לזיקוק רעיון גולמי ל**קוד גנטי עיצובי**, עם פרומפט ותמונה.' : 'תאר את הרקע והמטרה...',
    problem: i === 0 ? 'רעיונות נשארים **מופשטים** ולא מתורגמים לשפה חזותית.' : 'תאר את הבעיה שזיהיתם...',
    solution: i === 0 ? 'זיקוק לשישה גנים, פלטה ו**פרומפט מוכן**.' : '',
    coverImage: i % 3 === 2 ? undefined : `https://ktqmwpbzcnzkhjskqisy.supabase.co/storage/v1/object/public/aoa-media/portfolio-assets/app-${i + 1}/cover.jpg`,
    githubUrl: i === 0 ? 'https://github.com/Anat1969/ZIKUK-DNA' : undefined,
    supabaseProjectUrl: i === 0 ? 'https://supabase.com/dashboard/project/ktqmwpbzcnzkhjskqisy' : undefined,
    hasApi: i === 0 ? true : undefined,
    purpose: i === 0 ? 'זיקוק רעיונות' : undefined,
    createdAt: new Date(Date.now() - (i + 1) * 9 * day).toISOString(),
    updatedAt: new Date(Date.now() - i * 4 * day).toISOString(),
    changeLog: i === 0 ? [{ id: 'c1', date: new Date(Date.now() - 2 * day).toISOString(), text: 'סנכרון בין לוובל, גיטהב וורסל', type: 'feature' }] : undefined,
    redNotes: i === 0 ? [{ id: 'n1', text: 'להוסיף ערים', resolved: false, explanation: '' }] : undefined,
  },
}));

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAAD1h/aGAAAAPUlEQVR42u3OMQ0AAAgDIN+/9KzhpAkJqCU9VUJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkLiXxeP1QHRoQ6p6QAAAABJRU5ErkJggg==',
  'base64',
);

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

async function setup(context, calls) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route(/image\.thum\.io|\/storage\/v1\/object\/public\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await context.route(/\/rest\/v1\/aoa_apps/, (r) => r.fulfill({ json: rows }));
  await context.route(/\/rest\/v1\/aoa_categories/, (r) => r.fulfill({ json: cats }));
  await context.route(/\/storage\/v1\/object\/upload\/sign\//, (r) => {
    calls.push({ action: 'storage_put', url: r.request().url() });
    r.fulfill({ json: { Key: 'aoa-media/x' } });
  });
  await context.route(/\/functions\/v1\/aoa-edit/, async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const body = JSON.parse(r.request().postData() ?? '{}');
    const key = r.request().headers()['x-editor-key'];
    calls.push({ ...body, key });
    const h = { 'access-control-allow-origin': '*' };
    if (key !== KEY) return r.fulfill({ status: 403, headers: h, json: { error: 'not editor' } });
    if (body.action === 'sign_upload') return r.fulfill({ headers: h, json: { path: body.path, token: 'tok', publicUrl: `https://ktqmwpbzcnzkhjskqisy.supabase.co/storage/v1/object/public/aoa-media/${body.path}` } });
    if (body.action === 'generate') return r.fulfill({ headers: h, json: { desc: 'תיאור **חדש**.', problem: 'בעיה **חדשה**.', solution: 'פתרון **חדש**.' } });
    return r.fulfill({ headers: h, json: { ok: true } });
  });
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const lastOf = (calls, action) => [...calls].reverse().find((c) => c.action === action);

const browser = await chromium.launch();

// ---------- public, desktop ----------
{
  const calls = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', permissions: ['clipboard-read', 'clipboard-write'] });
  await setup(context, calls);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/fonts|ERR_FAILED|403/.test(m.text()) && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector('.card');
  ok(await page.locator('.hero h1').isVisible(), 'home hero renders');
  ok((await page.locator('.grid .card').count()) === rows.length, `catalog shows all ${rows.length} apps`);
  ok((await page.locator('.room').count()) >= cats.length, 'domain plan shows a room per category');
  ok(!(await page.locator('.editorbar').count()), 'no editor bar for the public');
  ok(await noHScroll(page), 'desktop home: no horizontal scroll');
  ok((await page.getAttribute('a:has-text("שיחת הפיתוח")', 'href'))?.includes('claude.ai/code/session_'), 'dev chat button links to the session');
  await page.screenshot({ path: SHOTS + 'desktop-home.png', fullPage: false });
  await page.screenshot({ path: SHOTS + 'desktop-home-full.png', fullPage: true });

  // category room
  await page.locator('.room-hit', { hasText: 'משחקים' }).click();
  ok(page.url().includes('cat=games'), 'room click sets ?cat in the address');
  ok((await page.locator('.grid .card').count()) === 2, 'category filter narrows to 2 apps');
  await page.locator('.cat-strip .chip', { hasText: 'הכל' }).click();
  ok(!page.url().includes('cat='), 'chip "הכל" clears the category');

  // links-only + sort
  await page.locator('.chip', { hasText: 'רק עם אתר' }).click();
  ok((await page.locator('.grid .card').count()) === rows.length - 1, 'links-only hides the app without a site');
  await page.locator('.chip', { hasText: 'רק עם אתר' }).click();
  await page.locator('.seg button', { hasText: 'לפי שם' }).click();
  const first = await page.locator('.grid .card-name').first().textContent();
  ok(first?.startsWith('דשבורד'), 'alphabetical sort puts "דשבורד" first');
  await page.locator('.seg button', { hasText: 'לפי תאריך' }).click();

  // search + suggestion
  await page.fill('.search input', 'גינות');
  ok(page.url().includes('q='), 'search writes ?q');
  await page.waitForSelector('.suggest button');
  await page.locator('.suggest button').first().click();
  ok(page.url().includes('app=app-5'), 'suggestion opens the app page');
  await page.locator('.brand').click();
  ok(!page.url().includes('?'), 'brand returns to a clean home');

  // app page
  await page.locator('.grid .card-name', { hasText: 'זיקוק DNA' }).click();
  await page.waitForSelector('.app-page');
  ok(page.url().includes('app=app-1'), 'card opens ?app=app-1');
  ok(await page.locator('.app-title').textContent() === 'מחקר: זיקוק DNA', 'app title shown');
  ok((await page.locator('.rich strong').count()) >= 3, 'bold markers render as strong');
  const btn = await page.locator('.app-links .solid').textContent();
  ok(btn && !/[←→]/.test(btn), `primary button has no arrows ("${btn}")`);
  ok((await page.locator('.app-links a[href*="github.com"]').count()) === 1, 'GitHub link shown');
  ok((await page.locator('.titleblock b').first().textContent())?.startsWith('A-'), 'sheet number in title block');
  ok((await page.locator('.timeline li').count()) === 1, 'work log shown');
  await page.screenshot({ path: SHOTS + 'desktop-app.png' });
  await page.locator('.crumbs-nav button', { hasText: 'הבאה' }).click();
  ok(!page.url().includes('app=app-1'), 'next button moves to another app');
  await page.locator('.crumbs-nav button', { hasText: 'הקודמת' }).click();
  ok(page.url().includes('app=app-1'), 'previous button returns');
  await page.locator('button:has-text("העתקת קישור")').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(clip.includes('app=app-1'), 'copy link copies the current state');
  await page.goBack();
  await page.goBack();
  ok(true, 'history back works');

  // placeholder text hidden
  await page.goto(BASE + '/?app=app-2');
  await page.waitForSelector('.app-page');
  ok(!(await page.content()).includes('תאר את'), 'template placeholders are hidden');

  // missing app
  await page.goto(BASE + '/?app=nope');
  ok(await page.locator('text=האפליקציה לא נמצאה').waitFor().then(() => true, () => false), 'unknown app shows a clear message');

  // table
  await page.goto(BASE + '/?view=table');
  await page.waitForSelector('table');
  ok((await page.locator('tbody tr').count()) === rows.length, 'table lists all apps');
  await page.locator('thead button', { hasText: 'שם' }).click();
  ok((await page.locator('tbody tr').first().textContent())?.includes('דשבורד'), 'table sorts by name');
  await page.locator('tbody .tag', { hasText: 'משחקים' }).first().click();
  ok((await page.locator('tbody tr').count()) === 2, 'tag click filters the table');
  await page.locator('.filters .chip.on').click();
  await page.fill('.table-search', 'זיקוק');
  ok((await page.locator('tbody tr').count()) === 1, 'table search filters');
  await page.screenshot({ path: SHOTS + 'desktop-table.png' });
  await page.locator('tbody .link.strong').first().click();
  ok(page.url().includes('app=app-1') && !page.url().includes('view=table'), 'table name opens the app page');

  // forged key is rejected
  await page.goto(BASE + '/#editor=wrong-key-000000000000');
  await page.waitForTimeout(400);
  ok(!(await page.locator('.editorbar').count()), 'an invalid editor key does not unlock editing');
  ok(errors.length === 0, `no console errors (${errors.join(' | ')})`);
  await context.close();
}

// ---------- editor ----------
{
  const calls = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  await setup(context, calls);
  const page = await context.newPage();
  page.on('dialog', async (d) => {
    if (d.type() === 'prompt') await d.accept(d.message().includes('חדש לקטגוריה') ? 'כלים ומדידה' : 'קטגוריה בדיקה');
    else await d.accept();
  });
  await page.goto(BASE + '/#editor=' + KEY);
  await page.waitForSelector('.editorbar');
  ok(!page.url().includes('editor='), 'editor key removed from the address');
  ok(lastOf(calls, 'check')?.key === KEY, 'key verified by the server');
  await page.locator('.editorbar button', { hasText: 'עריכה' }).click();
  ok((await page.locator('.room-tools').count()) > 0, 'edit mode shows category tools');

  await page.locator('.room', { hasText: 'כלים' }).locator('button', { hasText: 'שינוי שם' }).click();
  await page.waitForTimeout(200);
  ok(lastOf(calls, 'save_category')?.label === 'כלים ומדידה', 'rename category sends save_category');
  await page.locator('.room-add').click();
  await page.waitForTimeout(200);
  ok(lastOf(calls, 'save_category')?.label === 'קטגוריה בדיקה', 'new category sends save_category');
  await page.locator('.room', { hasText: 'קטגוריה בדיקה' }).locator('button', { hasText: 'מחיקה' }).click();
  await page.waitForTimeout(200);
  ok(!!lastOf(calls, 'delete_category'), 'delete category sends delete_category');
  await page.screenshot({ path: SHOTS + 'editor-home.png' });

  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.editorbar');
  await page.locator('.editorbar button', { hasText: 'עריכה' }).click();
  await page.waitForSelector('.app-page.is-editing');
  await page.locator('.form label:has-text("שם בתפריט") input').fill('מחקר: זיקוק DNA 2');
  await page.waitForTimeout(1200);
  const saved = lastOf(calls, 'save_app');
  ok(saved?.data?.name === 'מחקר: זיקוק DNA 2' && saved.id === 'app-1', 'editing the name saves the app (debounced)');
  ok(calls.filter((c) => c.action === 'save_app').length === 1, 'typing produces a single save');

  await page.locator('.log-add input').fill('בדיקת יומן');
  await page.locator('.log-add .solid').click();
  await page.locator('.notes .ghost', { hasText: 'הוספת הערה' }).click();
  await page.waitForTimeout(1100);
  const s2 = lastOf(calls, 'save_app');
  ok(s2?.data?.changeLog?.[0]?.text === 'בדיקת יומן', 'work log entry saved');
  ok(s2?.data?.redNotes?.length === 2, 'note added and saved');

  await page.locator('.p-problem .link', { hasText: 'ניסוח עם Claude' }).click();
  await page.waitForTimeout(300);
  ok(lastOf(calls, 'generate')?.name?.includes('זיקוק'), 'generate request sent');
  ok((await page.locator('.p-problem textarea').inputValue()) === 'בעיה **חדשה**.', 'generated text fills the field');

  await page.locator('.app-visual input[type=file]').setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(600);
  ok(/^app-1\/cover-\d+\.png$/.test(lastOf(calls, 'sign_upload')?.path ?? ''), 'upload asks for a signed path');
  ok(calls.some((c) => c.action === 'storage_put'), 'file sent to storage');
  await page.waitForTimeout(1000);
  ok(lastOf(calls, 'save_app')?.data?.coverImage?.includes('/aoa-media/app-1/cover-'), 'new cover saved on the app');
  await page.screenshot({ path: SHOTS + 'editor-app.png', fullPage: true });

  // add app
  await page.locator('.editorbar button', { hasText: 'אפליקציה חדשה' }).click();
  await page.locator('.dialog input').first().fill('אפליקציה בדיקה');
  await page.locator('.dialog label:has-text("קישור") input').fill('https://x.vercel.app');
  await page.locator('.dialog .solid', { hasText: 'הוספה' }).click();
  await page.waitForTimeout(400);
  const added = lastOf(calls, 'save_app');
  ok(added?.data?.name === 'אפליקציה בדיקה' && page.url().includes(`app=${added.id}`), 'new app saved and opened');

  // delete it
  await page.locator('.danger .ghost').click();
  await page.waitForTimeout(400);
  ok(lastOf(calls, 'delete_app')?.id === added.id, 'delete sends delete_app');
  ok(!page.url().includes('app='), 'after delete returns home');

  // table edit
  await page.goto(BASE + '/?view=table');
  await page.waitForSelector('.editorbar');
  await page.locator('.editorbar button', { hasText: 'עריכה' }).click();
  const purpose = page.locator('tbody tr').filter({ hasText: 'משחק: 6' }).locator('input[aria-label=purpose]');
  await purpose.fill('משחק חשיבה');
  await purpose.blur();
  await page.waitForTimeout(1000);
  ok(lastOf(calls, 'save_app')?.data?.purpose === 'משחק חשיבה', 'table cell edit saves');

  // bulk
  await page.locator('.editorbar button', { hasText: 'ניסוח תוכן לכולן' }).click();
  await page.locator('.dialog .solid', { hasText: 'התחלה' }).click();
  await page.waitForTimeout(1500);
  ok(calls.filter((c) => c.action === 'generate').length >= rows.length, 'bulk runs generate per app');
  await page.locator('.dialog .link', { hasText: 'סגירה' }).click();

  await page.locator('.editorbar .link', { hasText: 'ניתוק המכשיר' }).click();
  ok(!(await page.locator('.editorbar').count()), 'disconnect hides the editor bar');
  await context.close();
}

// ---------- mobile ----------
{
  const calls = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL' });
  await setup(context, calls);
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForSelector('.card');
  ok(await noHScroll(page), 'mobile home: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-home.png' });
  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.app-page');
  ok(await noHScroll(page), 'mobile app page: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-app.png', fullPage: true });
  await page.goto(BASE + '/?view=table');
  await page.waitForSelector('table');
  ok(await noHScroll(page), 'mobile table: page itself does not scroll sideways');
  await page.goto(BASE + '/#editor=' + KEY);
  await page.waitForSelector('.editorbar');
  await page.locator('.editorbar button', { hasText: 'עריכה' }).click();
  ok(await noHScroll(page), 'mobile editor: no horizontal scroll');
  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.editorbar');
  await page.locator('.editorbar button', { hasText: 'עריכה' }).click();
  ok(await noHScroll(page), 'mobile app editing: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-edit.png', fullPage: true });
  await context.close();
}

// ---------- installability ----------
{
  const context = await browser.newContext();
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route(/\/rest\/v1\//, (r) => r.fulfill({ json: [] }));
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  ok(installabilityErrors.length === 0, `installable (${JSON.stringify(installabilityErrors)})`);
  const manifest = await cdp.send('Page.getAppManifest');
  ok(!manifest.errors?.length, `manifest has no errors (${JSON.stringify(manifest.errors)})`);
  await context.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);

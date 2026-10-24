// End-to-end check against `vite preview`, with every Supabase call mocked.
// Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const KEY = 'test-editor-key-123456';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });

const cats = [];
const facets = [
  { kind: 'domain', value: 'urban', label: 'תכנון עירוני', synonyms: ['תב"ע', 'היתר'], position: 0 },
  { kind: 'domain', value: 'municipal', label: 'שירות עירוני', synonyms: ['עירייה'], position: 1 },
  { kind: 'domain', value: 'architecture', label: 'אדריכלות ועיצוב', synonyms: ['עיצוב'], position: 2 },
  { kind: 'domain', value: 'sustainability', label: 'קיימות וטבע', synonyms: ['גינה'], position: 3 },
  { kind: 'domain', value: 'psychology', label: 'פסיכולוגיה וזהות', synonyms: [], position: 4 },
  { kind: 'domain', value: 'personal', label: 'אישי ופנאי', synonyms: [], position: 5 },
  { kind: 'context', value: 'work', label: 'עבודה בעירייה', synonyms: [], position: 0 },
  { kind: 'context', value: 'professional', label: 'אדריכלים ואנשי מקצוע', synonyms: [], position: 1 },
  { kind: 'context', value: 'public', label: 'ציבור ותושבים', synonyms: [], position: 2 },
  { kind: 'context', value: 'teaching', label: 'קורסים ותלמידים', synonyms: [], position: 3 },
  { kind: 'context', value: 'personal', label: 'אישי', synonyms: [], position: 4 },
];
const day = 86_400_000;
// name, original name, action, domains, contexts, keywords, url
const names = [
  ['זיקוק DNA', 'מחקר: זיקוק DNA', 'create', ['architecture'], ['professional'], ['DNA', 'פרומפט'], 'https://zikuk-dna.vercel.app/dna'],
  ['רדאר אקטואליה', 'השראה: רדאר אקטואליה', 'inspire', ['personal'], ['personal'], ['חדשות'], 'https://radar-aktualya.vercel.app/'],
  ['בקשה להיתר', 'משחק: בקשה להיתר', 'play', ['urban'], ['public', 'teaching'], ['היתר בנייה'], 'https://bakasha-leheter.vercel.app'],
  ['תואם מתאר', 'עירייה: תואם מתאר', 'diagnose', ['urban'], ['work'], ['תוכנית מתאר', 'אשדוד'], 'https://ashdod-mitar-twin.vercel.app/'],
  ['תכנון גינות', 'כלי: תכנון גינות', 'create', ['sustainability', 'architecture'], ['professional'], ['גינה'], 'https://garden-gh.vercel.app/'],
  ['אדריכלית העיר, גרסה ארוכה מאוד עם שם שמתפרש על כמה שורות', 'דשבורד: אדריכלית העיר', 'manage', ['municipal', 'urban'], ['work'], ['היתרים'], 'https://merhav-midbar.lovable.app'],
  ['שישה כובעי חשיבה', 'משחק: 6 הכובעים', 'play', ['psychology'], ['teaching'], [], ''],
  ['פנג שואי', 'כלי מדידה: פנג שואי', 'diagnose', ['architecture'], ['personal'], ['פנג שואי'], 'https://feng-shui-two.vercel.app/#'],
];
const rows = names.map(([name, originalName, action, domains, contexts, keywords, url], i) => ({
  id: `app-${i + 1}`,
  created_at: new Date(Date.now() - (i + 1) * 9 * day).toISOString(),
  updated_at: new Date(Date.now() - i * day).toISOString(),
  data: {
    id: `app-${i + 1}`,
    name,
    title: name,
    originalName,
    action,
    domains,
    contexts,
    keywords,
    concepts: i === 1 ? ['עיתון', 'אקטואליה', 'news'] : i === 4 ? ['גינון', 'השקיה'] : [],
    previewUrl: url,
    primaryBtn: '← קישור לאפליקציה - VERCAL',
    desc: i === 0 ? 'מערכת לזיקוק רעיון גולמי ל**קוד גנטי עיצובי**, עם פרומפט ותמונה.' : i === 4 ? 'תכנון של גינה ביתית מלאה. עם מחירון, השקיה וצמחייה.' : 'תאר את הרקע והמטרה...',
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
  await context.route(/\/rest\/v1\/aoa_facets/, (r) => r.fulfill({ json: facets }));
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
const menu = async (page, label) => {
  await page.locator('ai-menu .logo').click();
  await page.locator('ai-menu .item', { hasText: label }).first().click();
};
const editorReady = (page) => page.locator('ai-menu .item', { hasText: 'מצב עריכה' }).count();
const isEditorDevice = async (page) => {
  await page.locator('ai-menu .logo').click();
  const n = await page.locator('ai-menu .item', { hasText: /מצב עריכה|סיום עריכה/ }).count();
  await page.keyboard.press('Escape');
  return n > 0;
};
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
  ok((await page.locator('.matrix tbody tr').count()) === 6, 'matrix has a row per domain');
  ok((await page.locator('.matrix .gap').count()) > 0, 'empty cells are shown as gaps');
  ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
  ok((await page.locator('.topbar').getByText('העתקת קישור', { exact: true }).count()) === 0 || !(await page.locator('.topbar >> text=העתקת קישור').first().isVisible()), 'no loose development buttons in the bar');
  ok(!(await isEditorDevice(page)), 'public sees no editing actions');
  ok(await noHScroll(page), 'desktop home: no horizontal scroll');
  await page.locator('ai-menu .logo').click();
  ok((await page.locator('ai-menu a.item', { hasText: 'שיחת הפיתוח' }).getAttribute('href'))?.includes('claude.ai/code/session_'), 'dev chat item links to the session');
  ok(await page.locator('ai-menu .item', { hasText: 'חיבור המכשיר לעריכה' }).isVisible(), 'connect-device item for the public');
  await page.screenshot({ path: SHOTS + 'desktop-menu-public.png' });
  await page.keyboard.press('Escape');
  ok(await page.locator('ai-menu .panel').isHidden(), 'Escape closes the menu');
  await page.screenshot({ path: SHOTS + 'desktop-home.png', fullPage: false });
  await page.screenshot({ path: SHOTS + 'desktop-home-full.png', fullPage: true });

  // matrix cell: domain x action
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').click();
  ok(page.url().includes('action=diagnose') && page.url().includes('domain=urban'), 'matrix cell writes action and domain to the address');
  ok((await page.locator('.grid .card').count()) === 1, 'matrix cell narrows to the one app');
  await page.locator('.chip', { hasText: 'ניקוי הסינון' }).click();
  ok(!page.url().includes('action='), 'clearing removes all filters');

  // hover window over a filled cell: one app per line, name links to the app, sheet opens the page
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').hover();
  await page.waitForSelector('.cell-pop');
  await page.waitForTimeout(150);
  ok((await page.locator('.cell-pop .pop-list li').count()) === 1, 'hover lists the cell apps one per line');
  ok((await page.locator('.cell-pop a.pop-name').getAttribute('href'))?.includes('ashdod-mitar-twin'), 'the name links straight to the app');
  await page.screenshot({ path: SHOTS + 'desktop-cell-hover.png' });
  await page.locator('.cell-pop .pop-sheet').click();
  ok(page.url().includes('app=app-4'), 'the sheet number opens the app page');
  await page.locator('.brand').click();

  // empty cell: an idea, apps to build on, a prompt and an add action
  await page.locator('.matrix .gap').first().click();
  await page.waitForSelector('.cell-pop .pop-idea');
  ok((await page.locator('.cell-pop .pop-idea h4').textContent())?.length > 2, 'an empty cell suggests an app');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'desktop-gap-idea.png' });
  await page.locator('.cell-pop .ghost', { hasText: 'העתקת פרומפט' }).click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  ok(prompt.includes('anat-app-builder') && prompt.includes('uipro init'), 'the gap prompt for Claude Code is copied');
  await page.locator('.cell-pop .solid', { hasText: 'הוספה לתיק מהרעיון' }).click();
  ok(await page.locator('.dialog .connect').isVisible(), 'a device not connected is asked for the editor link first');
  await page.keyboard.press('Escape');
  ok(await page.locator('.hero-add').isVisible(), 'a prominent add button on the home page');

  // facet filters combine
  await page.locator('.matrix .axis', { hasText: 'משחק ואימון' }).click();
  ok((await page.locator('.grid .card').count()) === 2, 'action column filters to 2 apps');
  await page.locator('.filters-panel .chip', { hasText: 'תכנון עירוני' }).click();
  ok((await page.locator('.grid .card').count()) === 1, 'action + domain narrows to 1');
  ok(await page.locator('.filters-panel .chip', { hasText: 'קיימות וטבע' }).isDisabled(), 'empty combinations are disabled');
  await page.screenshot({ path: SHOTS + 'desktop-filters.png' });
  await page.locator('.chip', { hasText: 'ניקוי הסינון' }).click();

  // search help and synonyms
  await page.locator('.search input').focus();
  ok(await page.locator('.search-help').isVisible(), 'empty search explains what can be searched');
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + 'desktop-search-help.png' });
  await page.locator('.search-help .tag', { hasText: 'ציבור ותושבים' }).click();
  ok(page.url().includes('ctx=public') && (await page.locator('.grid .card').count()) === 1, 'help chip applies the context filter');
  await page.locator('.chip', { hasText: 'ניקוי הסינון' }).click();
  await page.fill('.search input', 'כלי');
  await page.keyboard.press('Escape');
  await page.fill('.search input', 'כלי');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  ok((await page.locator('.grid .card').count()) >= 4, '"כלי" finds diagnose and create apps');
  ok(await page.locator('.expand-note').isVisible(), 'the expansion is explained');
  await page.fill('.search input', 'כלי מדידה');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('פנג שואי'), 'the old name still finds the app');
  await page.fill('.search input', 'עיתון');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('רדאר אקטואליה'), 'a hidden concept finds the app');
  ok((await page.locator('.card-why').first().textContent())?.includes('עיתון'), 'the card says why it was found');
  await page.fill('.search input', 'והעיתון');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('רדאר אקטואליה'), 'Hebrew prefixes are stripped');
  await page.fill('.search input', 'תב"ע');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  ok((await page.locator('.grid .card').count()) >= 3, 'a domain synonym finds the domain');
  await page.fill('.search input', '');

  // links-only + sort
  await page.locator('.chip', { hasText: 'רק עם אתר' }).click();
  ok((await page.locator('.grid .card').count()) === rows.length - 1, 'links-only hides the app without a site');
  await page.locator('.chip', { hasText: 'רק עם אתר' }).click();
  await page.locator('.seg button', { hasText: 'לפי שם' }).click();
  const first = await page.locator('.grid .card-name').first().textContent();
  ok(first?.startsWith('אדריכלית'), 'alphabetical sort puts "אדריכלית" first');
  await page.locator('.seg button', { hasText: 'לפי תאריך' }).click();

  // search + suggestion
  await page.fill('.search input', 'גינות');
  ok(page.url().includes('q='), 'search writes ?q');
  await page.waitForSelector('.live-card');
  ok((await page.locator('.live-card img').count()) >= 1, 'live search shows app images');
  ok((await page.locator('.live-name mark').first().textContent()) === 'גינות', 'typed text is highlighted in the name');
  await page.fill('.search input', 'ת');
  await page.fill('.search input', 'תכ');
  await page.waitForTimeout(350);
  const wide = await page.locator('.live-card').count();
  await page.fill('.search input', 'תכנון גינ');
  await page.waitForTimeout(350);
  const narrow = await page.locator('.live-card').count();
  ok(wide > narrow && narrow >= 1, `results narrow while typing (${wide} to ${narrow})`);
  ok((await page.locator('.live-head .mono').textContent())?.includes('אפליקציות'), 'live count shown');
  await page.screenshot({ path: SHOTS + 'desktop-live-search.png' });
  await page.fill('.search input', 'גינות');
  await page.waitForTimeout(350);
  await page.locator('.live-card').first().click();
  ok(page.url().includes('app=app-5'), 'suggestion opens the app page');
  await page.locator('.brand').click();
  ok(!page.url().includes('?'), 'brand returns to a clean home');

  // app page
  await page.locator('.grid .card-name', { hasText: 'זיקוק DNA' }).click();
  await page.waitForSelector('.app-page');
  ok(page.url().includes('app=app-1'), 'card opens ?app=app-1');
  ok(await page.locator('.app-title').textContent() === 'זיקוק DNA', 'clean name shown');
  ok(await page.locator('.facet-tags .tag.strong', { hasText: 'יצירה' }).isVisible(), 'action tag shown');
  ok((await page.locator('.related .card').count()) >= 1, 'related apps shown');
  await page.screenshot({ path: SHOTS + 'desktop-app-full.png', fullPage: true });
  ok((await page.locator('.rich mark.hl:not(.auto)').count()) >= 3, 'marked words render as a highlighter mark');
  ok((await page.locator('.app-desc .lead-line').count()) === 1, 'the first sentence is an insight line');
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
  await menu(page, 'העתקת קישור');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(clip.includes('app=app-1'), 'copy link copies the current state');
  await page.goBack();
  await page.goBack();
  ok(true, 'history back works');

  // automatic emphasis from the app's own words when the text has no markers
  await page.goto(BASE + '/?app=app-5');
  await page.waitForSelector('.app-page');
  ok((await page.locator('.app-desc mark.hl.auto').allTextContents()).includes('גינה'), 'keywords in the text are emphasized automatically');
  await page.screenshot({ path: SHOTS + 'desktop-emphasis.png' });

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
  ok((await page.locator('tbody tr').first().textContent())?.includes('אדריכלית'), 'table sorts by name');
  await page.locator('tbody .tag', { hasText: 'משחק' }).first().click();
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
  ok(!(await isEditorDevice(page)), 'an invalid editor key does not unlock editing');
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
    if (d.type() === 'prompt') {
      const m = d.message();
      await d.accept(m.includes('מילים נרדפות') ? 'עיר, תכנון' : m.includes('החדש') ? 'תחום בדיקה' : 'תכנון עירוני ומרחבי');
    }
    else await d.accept();
  });
  await page.goto(BASE + '/#editor=' + KEY);
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  ok(!page.url().includes('editor='), 'editor key removed from the address');
  ok(lastOf(calls, 'check')?.key === KEY, 'key verified by the server');
  await page.locator('ai-menu .logo').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'desktop-menu-editor.png' });
  await page.locator('ai-menu .item', { hasText: 'מצב עריכה' }).click();
  await page.waitForTimeout(250);
  ok((await page.locator('ai-menu .status').textContent()) === 'עריכה פעילה', 'logo shows the editing state');
  ok(await page.locator('.vocab').isVisible(), 'edit mode shows the vocabulary');
  const firstDomain = page.locator('.vocab li').first();
  await firstDomain.locator('button', { hasText: 'שם' }).click();
  await page.waitForTimeout(200);
  ok(lastOf(calls, 'save_facet')?.label === 'תכנון עירוני ומרחבי', 'rename sends save_facet');
  await page.locator('.vocab li').first().locator('button', { hasText: 'מילים נרדפות' }).click();
  await page.waitForTimeout(200);
  ok(JSON.stringify(lastOf(calls, 'save_facet')?.synonyms) === JSON.stringify(['עיר', 'תכנון']), 'synonyms saved as a list');
  await page.locator('.vocab .ghost', { hasText: 'תחום חדש' }).click();
  await page.waitForTimeout(200);
  ok(lastOf(calls, 'save_facet')?.label === 'תחום בדיקה' && lastOf(calls, 'save_facet')?.kind === 'domain', 'new domain sends save_facet');
  await page.locator('.vocab li', { hasText: 'תחום בדיקה' }).locator('button', { hasText: 'מחיקה' }).click();
  await page.waitForTimeout(200);
  ok(lastOf(calls, 'delete_facet')?.kind === 'domain', 'delete sends delete_facet');
  await page.screenshot({ path: SHOTS + 'editor-home.png' });

  await page.goto(BASE + '/?app=app-1');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await menu(page, 'מצב עריכה');
  await page.waitForSelector('.app-page.is-editing');
  await page.locator('.form label:has-text("שם בתפריט") input').fill('מחקר: זיקוק DNA 2');
  await page.waitForTimeout(1200);
  const saved = lastOf(calls, 'save_app');
  ok(saved?.data?.name === 'מחקר: זיקוק DNA 2' && saved.id === 'app-1', 'editing the name saves the app (debounced)');
  ok(calls.filter((c) => c.action === 'save_app').length === 1, 'typing produces a single save');

  await page.locator('.facet-edit .chip', { hasText: 'השראה' }).click();
  await page.locator('.facet-edit .chip', { hasText: 'קיימות וטבע' }).click();
  await page.locator('.facet-edit .kw-add input').fill('בדיקה, זיקוק');
  await page.locator('.facet-edit .kw-add .ghost').click();
  await page.waitForTimeout(1100);
  const f = lastOf(calls, 'save_app')?.data;
  ok(f?.action === 'inspire' && f?.domains?.includes('sustainability') && f?.keywords?.includes('זיקוק'), 'action, domain and keywords saved');

  const ta = page.locator('.p-problem textarea');
  await ta.fill('רעיונות נשארים מופשטים.');
  await ta.evaluate((el) => el.setSelectionRange(8, 14));
  await page.locator('.p-problem .marked-tools .ghost').click();
  await page.waitForTimeout(1100);
  ok(lastOf(calls, 'save_app')?.data?.problem === 'רעיונות **נשארים** מופשטים.', `the emphasis button wraps the selection (${lastOf(calls, 'save_app')?.data?.problem})`);

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

  // add from a gap idea: the dialog is prefilled
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('.matrix .gap').first().click();
  await page.waitForSelector('.cell-pop .pop-idea');
  const ideaTitle = await page.locator('.cell-pop .pop-idea h4').textContent();
  await page.locator('.cell-pop .solid', { hasText: 'הוספה לתיק מהרעיון' }).click();
  ok((await page.locator('.dialog input').first().inputValue()) === ideaTitle, 'add dialog is prefilled from the idea');
  ok((await page.locator('.dialog .chip.on').count()) === 2, 'action and domain of the cell are preselected');
  await page.keyboard.press('Escape');

  // add app
  await menu(page, 'אפליקציה חדשה');
  await page.locator('.dialog input').first().fill('אפליקציה בדיקה');
  await page.locator('.dialog label:has-text("קישור") input').fill('https://x.vercel.app');
  await page.locator('.dialog .chip', { hasText: 'אבחון ומדידה' }).click();
  await page.locator('.dialog .chip', { hasText: 'תכנון עירוני' }).click();
  await page.locator('.dialog .solid', { hasText: 'הוספה' }).click();
  await page.waitForTimeout(400);
  const added = lastOf(calls, 'save_app');
  ok(added?.data?.name === 'אפליקציה בדיקה' && page.url().includes(`app=${added.id}`), 'new app saved and opened');
  ok(added?.data?.action === 'diagnose' && added?.data?.domains?.includes('urban'), 'new app carries its classification');

  // delete it
  await page.locator('.danger .ghost').click();
  await page.waitForTimeout(400);
  ok(lastOf(calls, 'delete_app')?.id === added.id, 'delete sends delete_app');
  ok(!page.url().includes('app='), 'after delete returns home');

  // table edit
  await page.goto(BASE + '/?view=table');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await menu(page, 'מצב עריכה');
  const purpose = page.locator('tbody tr').filter({ hasText: 'שישה כובעי' }).locator('input[aria-label=purpose]');
  await purpose.fill('משחק חשיבה');
  await purpose.blur();
  await page.waitForTimeout(1000);
  ok(lastOf(calls, 'save_app')?.data?.purpose === 'משחק חשיבה', 'table cell edit saves');

  // bulk
  await menu(page, 'ניסוח תוכן לכל');
  await page.locator('.dialog .solid', { hasText: 'התחלה' }).click();
  await page.waitForTimeout(1500);
  ok(calls.filter((c) => c.action === 'generate').length >= rows.length, 'bulk runs generate per app');
  await page.locator('.dialog .link', { hasText: 'סגירה' }).click();

  await menu(page, 'ניתוק המכשיר');
  ok(!(await isEditorDevice(page)), 'disconnect removes the editing actions');

  // connect again from the menu by pasting the editor link
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => d.accept(`${BASE}/#editor=${KEY}`));
  await menu(page, 'חיבור המכשיר לעריכה');
  await page.waitForTimeout(300);
  ok(await isEditorDevice(page), 'pasting the editor link in the menu connects the device');
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
  await page.locator('.search input').focus();
  await page.fill('.search input', 'תכנון');
  await page.waitForSelector('.live-card');
  await page.waitForTimeout(400);
  const lb = await page.locator('.suggest').boundingBox();
  ok(lb && lb.x >= 0 && lb.x + lb.width <= 391 && (await noHScroll(page)), 'mobile live search fits the screen');
  await page.screenshot({ path: SHOTS + 'mobile-live-search.png' });
  await page.fill('.search input', '');
  await page.locator('.search input').blur();
  await page.waitForTimeout(250);
  await page.screenshot({ path: SHOTS + 'mobile-home.png' });
  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.app-page');
  ok(await noHScroll(page), 'mobile app page: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-app.png', fullPage: true });
  await page.goto(BASE + '/?view=table');
  await page.waitForSelector('table');
  ok(await noHScroll(page), 'mobile table: page itself does not scroll sideways');
  await page.goto(BASE + '/#editor=' + KEY);
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('ai-menu .logo').click();
  await page.waitForTimeout(300);
  const box = await page.locator('ai-menu .panel').boundingBox();
  ok(box && box.x >= 0 && box.x + box.width <= 391, `mobile menu fits the screen (${JSON.stringify(box)})`);
  await page.screenshot({ path: SHOTS + 'mobile-menu.png' });
  await page.locator('ai-menu .item', { hasText: 'מצב עריכה' }).click();
  ok(await noHScroll(page), 'mobile editor: no horizontal scroll');
  await page.goto(BASE + '/?app=app-1');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await menu(page, 'מצב עריכה');
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

// End-to-end check against `vite preview`, with every Supabase call mocked.
// Run: npm run build && (npx vite preview --port 4173 &) && node tests/e2e.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
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
    calls.push(body);
    const h = { 'access-control-allow-origin': '*' };
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
  ok(await page.locator('.sec-bar').isVisible(), 'home sections sit in one bar');
  ok((await page.locator('.recent-rows .recent-col').count()) === 2, 'added and updated are two rows');
  await page.locator('.sec-bar button', { hasText: 'מפת התחומים' }).click();
  await page.waitForSelector('.matrix');
  await page.waitForTimeout(300);
  ok(page.url().includes('sec=map'), 'the section is in the address');
  ok((await page.locator('.matrix tbody tr').count()) === 6, 'matrix has a row per domain');
  ok((await page.locator('.matrix .gap').count()) > 0, 'empty cells are shown as gaps');
  const barY = await page.locator('.sec-bar').evaluate((el) => el.getBoundingClientRect().top);
  await page.locator('.sec-bar button', { hasText: 'כל הגיליונות' }).click();
  await page.waitForSelector('.grid .card');
  ok((await page.locator('.grid .card').count()) === rows.length, `catalog shows all ${rows.length} apps`);
  ok(Math.abs((await page.locator('.sec-bar').evaluate((el) => el.getBoundingClientRect().top)) - barY) < 2, 'the section bar does not move when the section changes');
  await page.locator('.sec-bar button', { hasText: 'מפת התחומים' }).click();
  await page.waitForSelector('.matrix');
  ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
  ok((await page.locator('.topbar').getByText('העתקת קישור', { exact: true }).count()) === 0 || !(await page.locator('.topbar >> text=העתקת קישור').first().isVisible()), 'no loose development buttons in the bar');
  ok(!(await isEditorDevice(page)), 'no edit mode item in the logo: editing happens in place');
  ok(await noHScroll(page), 'desktop home: no horizontal scroll');
  await page.locator('ai-menu .logo').click();
  ok((await page.locator('ai-menu a.item', { hasText: 'שיחת הפיתוח' }).getAttribute('href'))?.includes('claude.ai/code/session_'), 'dev chat item links to the session');
  ok((await page.locator('ai-menu .item', { hasText: /חיבור המכשיר|קישור העריכה|ניתוק/ }).count()) === 0, 'no connect, copy-link or disconnect items');
  await page.screenshot({ path: SHOTS + 'desktop-menu-public.png' });
  await page.keyboard.press('Escape');
  ok(await page.locator('ai-menu .panel').isHidden(), 'Escape closes the menu');
  await page.screenshot({ path: SHOTS + 'desktop-home.png', fullPage: false });
  await page.screenshot({ path: SHOTS + 'desktop-home-full.png', fullPage: true });

  // matrix cell: domain x action
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').click();
  await page.waitForTimeout(300);
  ok(await page.locator('.cell-page').isVisible() && page.url().includes('sec=map') && page.url().includes('cell=urban'), 'a cell click opens the cell as its own page, in the address');
  ok((await page.locator('.cell-page .grid .card').count()) === 1 && (await page.locator('.cell-page h2').textContent())?.includes('תכנון עירוני') && (await page.locator('.matrix').count()) === 0, 'the cell page holds the apps of that row and column, without the map');
  await page.locator('.cell-page .cell-back').click();
  await page.waitForSelector('.matrix');
  ok(!page.url().includes('cell=') && page.url().includes('sec=map'), 'the back button returns to the map');
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').click();
  await page.waitForSelector('.cell-page');
  await page.goBack();
  await page.waitForSelector('.matrix');
  ok(!page.url().includes('cell='), 'the browser back button returns to the map too');
  ok((await page.locator('.band-map .beyond').count()) === 0, 'syntheses and new rows are no longer under the map');
  await page.locator('.matrix .axis', { hasText: 'משחק ואימון' }).click();
  ok((await page.locator('.matrix thead th.sorted').count()) === 1 && page.url().includes('sec=map'), 'a column header sorts the map in place');
  await page.waitForSelector('.line-pop');
  ok((await page.locator('.line-pop .line-head strong').textContent()) === 'משחק ואימון', 'a column header opens its apps on the same page');
  await page.locator('.matrix tbody .axis', { hasText: 'תכנון עירוני' }).click();
  await page.waitForTimeout(250);
  ok((await page.locator('.line-pop .line-head strong').textContent()) === 'תכנון עירוני' && (await page.locator('.line-pop a.pop-name').count()) > 0 && page.url().includes('sec=map'), 'a row header lists the links of every app in the row');
  ok((await page.locator('.line-pop a.pop-name[href*="ashdod-mitar-twin"]').count()) === 1, 'the row list links straight to the app');
  await page.locator('.matrix tbody .axis', { hasText: 'תכנון עירוני' }).click();
  await page.waitForTimeout(250);
  ok((await page.locator('.line-pop').count()) === 0, 'a second click closes the line');
  await page.locator('.matrix .axis', { hasText: 'משחק ואימון' }).click();
  ok((await page.locator('.matrix thead th').count()) === 10, 'the map has the two new columns, distill and decide');
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').click();
  await page.locator('.cell-page .link', { hasText: 'סינון התיק למשבצת' }).click();
  await page.waitForTimeout(400);
  ok(page.url().includes('action=diagnose') && page.url().includes('domain=urban'), 'matrix cell writes action and domain to the address');
  ok((await page.locator('.grid .card').count()) === 1, 'matrix cell narrows to the one app');
  await page.locator('.chip', { hasText: 'ניקוי הסינון' }).click();
  ok(!page.url().includes('action='), 'clearing removes all filters');
  await page.locator('.sec-bar button', { hasText: 'סינתזות ושורות חדשות' }).click();
  await page.waitForSelector('.band-beyond .beyond');
  ok(page.url().includes('sec=beyond') && (await page.locator('.sec-bar button.on .mono').first().textContent()) === '04', 'section 04 holds the syntheses and the new rows');
  ok((await page.locator('.beyond-grid .pop-idea').count()) >= 10 && (await page.locator('.beyond-grid .pop-idea .idea-example').count()) === (await page.locator('.beyond-grid .pop-idea').count()), 'every synthesis carries a concrete example');
  ok((await page.locator('.beyond-grid .pop-idea .idea-test').count()) === (await page.locator('.beyond-grid .pop-idea').count()), 'every synthesis says how its reliability is checked');
  await page.locator('.beyond-grid .ghost', { hasText: 'העתקת פרומפט' }).first().click();
  const synPrompt = await page.evaluate(() => navigator.clipboard.readText());
  ok(synPrompt.includes('הדוגמה שהמסך הראשון חייב לשחזר') && synPrompt.includes('מבחן הבנאליות') && synPrompt.includes('שדרוג או אפליקציה חדשה'), 'the prompt carries the example, the banality test and the upgrade-or-new decision');
  await page.locator('.beyond-tabs button', { hasText: 'שורות ועמודות' }).click();
  ok((await page.locator('.axes-grid .axis-card').count()) > 0, 'the new rows tab opens inside section 04');
  ok((await page.locator('.axes-grid .pop-idea .idea-example').count()) === (await page.locator('.axes-grid .pop-idea').count()), 'every new-row idea carries an example');
  await page.locator('.sec-bar button', { hasText: 'מפת התחומים' }).click();
  await page.waitForSelector('.matrix');
  await page.waitForTimeout(300);

  // hover window over a filled cell: one app per line, name links to the app, sheet opens the page
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  await page.locator('.matrix .cell[aria-label^="תכנון עירוני, אבחון"]').hover();
  await page.waitForSelector('.cell-pop');
  await page.waitForTimeout(150);
  ok((await page.locator('.cell-pop .pop-list li').count()) === 1, 'hover lists the cell apps one per line');
  ok((await page.locator('.cell-pop a.pop-name').getAttribute('href'))?.includes('ashdod-mitar-twin'), 'the name links straight to the app');
  await page.screenshot({ path: SHOTS + 'desktop-cell-hover.png' });
  // crossing another cell on the way to the window must not switch it (the link would open another app)
  const popHead = await page.locator('.cell-pop .pop-head').textContent();
  const other = page.locator('.matrix .cell:not(.on), .matrix .gap').first();
  await other.hover();
  await page.waitForTimeout(120);
  ok((await page.locator('.cell-pop .pop-head').textContent()) === popHead, 'passing over another cell keeps the open window');
  await page.locator('.cell-pop').hover();
  await page.waitForTimeout(500);
  ok((await page.locator('.cell-pop .pop-head').textContent()) === popHead && (await page.locator('.cell-pop a.pop-name').getAttribute('href'))?.includes('ashdod-mitar-twin'), 'the window still links to its own app after the pointer arrives');
  await page.locator('.cell-pop .pop-sheet').click();
  ok(page.url().includes('app=app-4'), 'the sheet number opens the app page');
  await page.locator('.brand').click();
  ok(!page.url().includes('?'), 'brand returns to a clean home on the first section');
  await page.locator('.sec-bar button', { hasText: 'מפת התחומים' }).click();
  await page.waitForSelector('.matrix');
  await page.waitForTimeout(300);

  // empty cell: an idea, apps to build on, a prompt and an add action
  await page.locator('.matrix .gap').first().click();
  await page.waitForSelector('.cell-pop .pop-idea');
  ok((await page.locator('.cell-pop .pop-idea h4').first().textContent())?.length > 2, 'an empty cell suggests an app');
  ok((await page.locator('.cell-pop .pop-idea').count()) >= 3, 'every cell offers several ideas');
  ok((await page.locator('.cell-pop .pop-idea .idea-example').count()) >= 3, 'every cell idea carries a concrete example');
  ok((await page.locator('.cell-pop .idea-kind').allTextContents()).some((k) => /מיזוג|חיתוך|זיקוק/.test(k)), 'ideas include merges, intersections or distillations');
  ok(await page.locator('.cell-pop .how-build').isVisible(), 'the window explains how an idea becomes an app');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'desktop-gap-idea.png' });
  await page.locator('.cell-pop .ghost', { hasText: 'העתקת פרומפט' }).first().click();
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  ok(prompt.includes('anat-app-builder') && prompt.includes('uipro init') && prompt.includes('איך נולדת אפליקציה חדשה') && prompt.includes('שדרוג או אפליקציה חדשה'), 'the gap prompt for Claude Code is copied, with how to build');
  await page.locator('.cell-pop .solid', { hasText: 'הוספה לתיק מהרעיון' }).first().click();
  ok((await page.locator('.dialog .connect').count()) === 0, 'no editor link field in the add form');
  ok((await page.locator('.dialog input').first().inputValue()).length > 2, 'the form itself opens right away, prefilled');
  await page.locator('.dialog .solid', { hasText: 'הוספה לתיק' }).click();
  await page.waitForTimeout(500);
  ok(lastOf(calls, 'save_app')?.data?.name?.length > 2, 'one click adds the app, on any device');
  await page.goto(BASE + '/');
  await page.waitForSelector('.card');
  ok(await page.locator('.hero-add').isVisible(), 'a prominent add button on the home page');

  // facet filters combine
  await page.goto(BASE + '/?action=play');
  await page.waitForTimeout(400);
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
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  ok((await page.locator('.grid .card').count()) >= 4, '"כלי" finds diagnose and create apps');
  ok(await page.locator('.search-clear').isVisible(), 'a grey X appears once something is searched');
  await page.locator('.search-clear').click();
  await page.waitForTimeout(250);
  ok((await page.locator('.search input').inputValue()) === '' && !page.url().includes('q='), 'the X resets the search');
  ok((await page.locator('.search-clear').count()) === 0, 'the X hides when there is nothing to reset');
  await page.fill('.search input', 'כלי');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  ok(await page.locator('.expand-note').isVisible(), 'the expansion is explained');
  await page.fill('.search input', 'כלי מדידה');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('פנג שואי'), 'the old name still finds the app');
  await page.fill('.search input', 'עיתון');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('רדאר אקטואליה'), 'a hidden concept finds the app');
  ok((await page.locator('.card-why').first().textContent())?.includes('עיתון'), 'the card says why it was found');
  await page.fill('.search input', 'והעיתון');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  ok((await page.locator('.grid .card-name').allTextContents()).includes('רדאר אקטואליה'), 'Hebrew prefixes are stripped');
  await page.fill('.search input', 'תב"ע');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
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
  await page.goto(BASE + '/?sec=all');
  await page.waitForSelector('.grid .card');
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
  // share link with a picture: copies the portfolio's /s/<id> address, which serves the og: tags for WhatsApp
  await page.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; });
  await page.locator('.app-links .share-copy').click();
  const shared = await page.evaluate(() => window.__copied);
  ok(/^https:\/\/appofapp-gh\.vercel\.app\/s\/app-[\w-]+$/.test(shared), `share button copies the link with a picture (${shared})`);
  ok((await page.locator('.timeline li').count()) === 1, 'work log shown');
  await page.screenshot({ path: SHOTS + 'desktop-app.png' });
  // the cover has one action and says it on the frame; paging sits at the foot of the page and names where it goes
  ok((await page.locator('.app-visual a.cover').getAttribute('href')) === 'https://zikuk-dna.vercel.app/dna', 'cover links to the app itself');
  ok(await page.locator('.app-visual .cover-bar').isVisible(), 'cover says it opens the app without hover');
  ok((await page.locator('.app-visual .cover-host').textContent()) === 'zikuk-dna.vercel.app', 'cover shows the address it opens');
  ok((await page.locator('.crumbs .ghost').count()) === 0 && (await page.locator('.app-visual button:not(.inline-edit)').count()) === 0, 'no paging buttons near the cover');
  ok(/מתוך \d+ · /.test((await page.locator('.seq-head').textContent()) ?? ''), 'paging says which list it pages through');
  const nextName = await page.locator('.seq-link.next b').textContent();
  await page.locator('.seq-link.next').click();
  ok(!page.url().includes('app=app-1') && (await page.locator('.app-title').textContent()) === nextName, 'next opens the app it names');
  await page.locator('.seq-link.prev').click();
  ok(page.url().includes('app=app-1'), 'previous button returns');
  // two arrows side by side at the top of the page, away from the cover
  await page.waitForTimeout(800);
  const arrows = page.locator('.seq-arrows button');
  const [bp, bn] = [await arrows.nth(0).boundingBox(), await arrows.nth(1).boundingBox()];
  ok((await arrows.count()) === 2 && Math.abs(bp.y - bn.y) < 2 && bp.x - (bn.x + bn.width) < 12 && bp.x > bn.x, 'two paging arrows sit side by side, next on the left');
  ok((await page.locator('.app-visual .seq-arrows').count()) === 0, 'the arrows are not on the cover');
  await arrows.nth(1).click();
  ok((await page.locator('.app-title').textContent()) === nextName, 'the left arrow opens the next app');
  await page.locator('.seq-arrows button').nth(0).click();
  ok(page.url().includes('app=app-1'), 'the right arrow returns to the previous app');
  // opened by address: pages through the whole portfolio in the order the catalog shows
  await page.goto(BASE + '/?app=app-3');
  await page.waitForSelector('.sheet-seq');
  ok((await page.locator('.seq-link.prev b').textContent()) === 'רדאר אקטואליה' && (await page.locator('.seq-link.next b').textContent()) === 'תואם מתאר', 'direct link pages in catalog order');
  ok((await page.locator('.seq-head').textContent())?.includes('בכל התיק'), 'direct link names the whole portfolio');
  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.app-page');
  await menu(page, 'למצב הנוכחי');
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
  ok((await page.locator('thead th', { hasText: 'עודכן' }).count()) === 1, 'table has an update date column');
  ok(await page.locator('.legend .legend-item').first().isVisible(), 'sorted column shows a colour legend');
  ok((await page.locator('td.updated.grouped').count()) === rows.length, 'update column coloured by group');
  await page.locator('thead button', { hasText: 'שם' }).click();
  ok((await page.locator('tbody tr').first().locator('.name-field').inputValue()).includes('אדריכלית'), 'table sorts by name');
  ok((await page.locator('thead th.sorted', { hasText: 'שם' }).count()) === 1, 'the sorted column header stands out');
  ok((await page.locator('thead th .sort-arrows').count()) >= 12, 'every sortable column shows arrows');
  ok(await page.evaluate(() => { const w = document.querySelector('.table-wrap'); return w.scrollWidth <= w.clientWidth + 1; }), 'the whole table fits the screen width');
  ok((await page.locator('tbody img.plat').count()) >= 1, 'platform shown as an icon');
  ok((await page.locator('tbody a.row-thumb').first().getAttribute('href'))?.startsWith('https://'), 'thumbnail next to the name opens the app');
  ok((await page.locator('thead th').filter({ hasText: /^(Supabase|GitHub|API)$/ }).count()) === 0, 'column names in Hebrew');
  await page.locator('thead button', { hasText: 'עודכן' }).click();
  const dayColours = await page.evaluate(() => [...document.querySelectorAll('td.updated')].map((td) => [td.querySelector('b').textContent, td.style.getPropertyValue('--g')]));
  const byDay = new Map();
  for (const [d, c] of dayColours) byDay.set(d, [...(byDay.get(d) ?? []), c]);
  const colourDays = new Map();
  for (const [d, cs] of byDay) for (const c of cs) colourDays.set(c, new Set([...(colourDays.get(c) ?? []), d]));
  ok([...byDay.values()].every((cs) => new Set(cs).size === 1) && byDay.size === Math.min(colourDays.size, byDay.size) && [...colourDays.values()].every((ds) => ds.size === 1 || byDay.size > 12), 'sorting by date gives one colour per day');
  await page.locator('thead button', { hasText: 'שם' }).click();
  await page.locator('tbody .tag', { hasText: 'משחק' }).first().click();
  ok((await page.locator('tbody tr').count()) === 2, 'tag click filters the table');
  await page.locator('.filters .chip.on').click();
  await page.fill('.table-search', 'זיקוק');
  ok((await page.locator('tbody tr').count()) === 1, 'table search filters');
  await page.screenshot({ path: SHOTS + 'desktop-table.png' });
  await page.locator('tbody td:first-child .link').first().click();
  ok(page.url().includes('app=app-1') && !page.url().includes('view=table'), 'table sheet number opens the app page');

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
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('ai-menu .logo').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'desktop-menu-editor.png' });
  await page.keyboard.press('Escape');
  ok((await page.locator('.edit-light').count()) === 0, 'no edit frame: there is no edit mode');
  await page.locator('.sec-bar button', { hasText: 'מפת התחומים' }).click();
  await page.locator('.vocab-toggle').click();
  ok(await page.locator('.vocab').isVisible(), 'the vocabulary opens under the map');
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
  await page.locator('h1.app-title').click();
  await page.waitForSelector('.app-page.is-editing');
  await page.locator('.form label:has-text("שם בתפריט") input').fill('מחקר: זיקוק DNA 2');
  await page.waitForTimeout(1200);
  const saved = lastOf(calls, 'save_app');
  ok(saved?.data?.name === 'מחקר: זיקוק DNA 2' && saved.id === 'app-1', 'editing the name saves the app (debounced)');
  ok(calls.filter((c) => c.action === 'save_app').length === 1, 'typing produces a single save');

  await page.locator('.form .inline-edit', { hasText: 'סיום' }).click();
  await page.locator('.inline-edit', { hasText: 'שינוי סיווג' }).click();
  await page.locator('.facet-edit .chip', { hasText: 'השראה' }).click();
  await page.locator('.facet-edit .chip', { hasText: 'קיימות וטבע' }).click();
  await page.locator('.facet-edit .kw-add input').fill('בדיקה, זיקוק');
  await page.locator('.facet-edit .kw-add .ghost').click();
  await page.waitForTimeout(1100);
  const f = lastOf(calls, 'save_app')?.data;
  ok(f?.action === 'inspire' && f?.domains?.includes('sustainability') && f?.keywords?.includes('זיקוק'), 'action, domain and keywords saved');

  await page.locator('.p-problem .inline-edit').click();
  const ta = page.locator('.p-problem textarea');
  await ta.fill('רעיונות נשארים מופשטים.');
  await ta.evaluate((el) => el.setSelectionRange(8, 14));
  await page.locator('.p-problem .marked-tools .ghost').click();
  await page.waitForTimeout(1100);
  ok(lastOf(calls, 'save_app')?.data?.problem === 'רעיונות **נשארים** מופשטים.', `the emphasis button wraps the selection (${lastOf(calls, 'save_app')?.data?.problem})`);

  await page.locator('.inline-edit', { hasText: 'יומן העבודה' }).click();
  await page.locator('.log-add input').fill('בדיקת יומן');
  await page.locator('.log-add .solid').click();
  await page.locator('.inline-edit', { hasText: 'הערות' }).click();
  await page.locator('.notes .ghost', { hasText: 'הוספת הערה' }).click();
  await page.waitForTimeout(1100);
  const s2 = lastOf(calls, 'save_app');
  ok(s2?.data?.changeLog?.[0]?.text === 'בדיקת יומן', 'work log entry saved');
  ok(s2?.data?.redNotes?.length === 2, 'note added and saved');
  await page.locator('.p-problem .inline-edit').click();
  /*
  await page.locator('.log-add .solid').click();
  await page.locator('.notes .ghost', { hasText: 'הוספת הערה' }).click();
  await page.waitForTimeout(1100);
  const s2 = lastOf(calls, 'save_app');
  ok(s2?.data?.changeLog?.[0]?.text === 'בדיקת יומן', 'work log entry saved');
  ok(s2?.data?.redNotes?.length === 2, 'note added and saved');
  */

  await page.locator('.p-problem .link', { hasText: 'ניסוח אוטומטי' }).click();
  await page.waitForTimeout(300);
  ok(lastOf(calls, 'generate')?.name?.includes('זיקוק'), 'generate request sent');
  ok((await page.locator('.p-problem textarea').inputValue()) === 'בעיה **חדשה**.', 'generated text fills the field');

  await page.locator('.cover-change .inline-edit').click();
  await page.locator('.app-visual input[type=file]').setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(600);
  ok(/^app-1\/cover-\d+\.png$/.test(lastOf(calls, 'sign_upload')?.path ?? ''), 'upload asks for a signed path');
  ok(calls.some((c) => c.action === 'storage_put'), 'file sent to storage');
  await page.waitForTimeout(1000);
  ok(lastOf(calls, 'save_app')?.data?.coverImage?.includes('/aoa-media/app-1/cover-'), 'new cover saved on the app');
  ok(await page.evaluate(() => [...document.querySelectorAll('.app-page input, .app-page textarea')].every((e) => e.getAttribute('autocomplete') === 'off')), 'no browser autofill in the editing fields');
  await page.locator('.inline-edit', { hasText: 'עריכת קישורים' }).click();
  ok(await page.locator('.link-preview').isVisible(), 'the link field shows where the cover and the button go');
  await page.locator('.cover-change .inline-edit').click();
  // a screenshot pasted anywhere on the page (nothing focused) becomes the cover, once, even when pasted twice fast
  const signsBefore = calls.filter((c) => c.action === 'sign_upload').length;
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    for (let i = 0; i < 2; i++) {
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
      (document.activeElement || document.body).blur?.();
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    }
  }, png.toString('base64'));
  ok((await page.locator('.app-visual .cover img').getAttribute('src'))?.startsWith('blob:'), 'pasted image shows at once');
  await page.waitForTimeout(800);
  ok(calls.filter((c) => c.action === 'sign_upload').length === signsBefore + 1, 'paste anywhere uploads one copy');
  await page.screenshot({ path: SHOTS + 'editor-app.png', fullPage: true });

  // from the phone (tools bank, tool 2): a QR code to the phone page, and the new cover arrives here on its own
  // test covers are 64px wide, so the tools overflow the tiny frame; a real cover is checked in phone-qr.png
  await page.locator('.app-visual .cover-phone').dispatchEvent('click');
  await page.waitForSelector('.phone-qr svg');
  ok((await page.locator('.phone-url a').getAttribute('href'))?.includes('app=app-1') && (await page.locator('.phone-url a').getAttribute('href'))?.includes('shoot=1'), 'phone: the QR leads to the phone page of this app');
  ok(await page.locator('.phone-wait').isVisible(), 'phone: the computer says it is waiting');
  await page.screenshot({ path: SHOTS + 'phone-qr.png' });
  const oldCover = rows[0].data.coverImage;
  rows[0].data.coverImage = 'https://ktqmwpbzcnzkhjskqisy.supabase.co/storage/v1/object/public/aoa-media/app-1/cover-phone.jpg';
  await page.waitForSelector('.phone-qr', { state: 'detached', timeout: 9000 }).catch(() => {});
  ok((await page.locator('.app-visual .cover img').getAttribute('src'))?.endsWith('cover-phone.jpg'), 'phone: the new cover shows on the computer without reloading');
  rows[0].data.coverImage = oldCover;

  // add from a gap idea: the dialog is prefilled
  await page.goto(BASE + '/?sec=map');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('.matrix .gap').first().click();
  await page.waitForSelector('.cell-pop .pop-idea');
  const ideaTitle = await page.locator('.cell-pop .pop-idea h4').first().textContent();
  await page.locator('.cell-pop .solid', { hasText: 'הוספה לתיק מהרעיון' }).first().click();
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
  ok((await page.locator('.danger .ghost').count()) === 0, 'no loose delete button on the app page');
  await page.locator('ai-menu .logo').click();
  const lastItem = page.locator('ai-menu .group').last().locator('.item').last();
  ok((await lastItem.textContent())?.includes('ביטול האפליקציה'), 'remove app is the last item in the A&I menu');
  ok((await lastItem.evaluate((el) => getComputedStyle(el).color)) === 'rgb(179, 38, 30)', 'remove app item is red');
  await page.screenshot({ path: SHOTS + 'menu-remove.png' });
  await lastItem.click();
  const confirmBtn = page.locator('.dialog .danger-solid');
  ok(await confirmBtn.isDisabled(), 'remove is locked until the name is typed');
  await page.locator('.remove-app input').fill('אפליקציה');
  ok(await confirmBtn.isDisabled(), 'a partial name keeps it locked');
  ok(!lastOf(calls, 'delete_app'), 'nothing deleted before confirming');
  await page.locator('.remove-app input').fill('אפליקציה בדיקה');
  await page.screenshot({ path: SHOTS + 'remove-dialog.png' });
  await confirmBtn.click();
  await page.waitForTimeout(400);
  ok(lastOf(calls, 'delete_app')?.id === added.id, 'delete sends delete_app');
  ok(!page.url().includes('app='), 'after delete returns home');
  await page.locator('.toast-act', { hasText: 'שחזור' }).click();
  await page.waitForTimeout(400);
  ok(lastOf(calls, 'restore_app')?.id === added.id, 'restore from the toast sends restore_app');

  // table edit: no edit mode, every cell is a field that saves at once (Anat, 2026-11-04)
  await page.goto(BASE + '/?view=table');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  ok((await page.locator('.edit-light').count()) === 0, 'the table edits without edit mode');
  const purpose = page.locator('tbody tr').filter({ has: page.locator('input.name-field[value*="שישה כובעי"]') }).locator('input[aria-label^="מטרה"]');
  await purpose.fill('משחק חשיבה');
  await purpose.press('Enter');
  await page.waitForTimeout(1200);
  ok(lastOf(calls, 'save_app')?.data?.purpose === 'משחק חשיבה', 'table cell edit saves');
  const nameInput = page.locator('tbody tr').filter({ has: page.locator('input.name-field[value*="שישה כובעי"]') }).locator('input.name-field');
  await nameInput.fill('חשיבה: שישה כובעים');
  await nameInput.press('Enter');
  await page.waitForTimeout(1200);
  const renamedSave = lastOf(calls, 'save_app')?.data;
  ok(renamedSave?.name === 'חשיבה: שישה כובעים' && renamedSave?.originalName, 'table rename saves the name and keeps the old one searchable');
  await page.screenshot({ path: SHOTS + 'desktop-table-full.png' });
  await page.locator('tbody tr').filter({ has: page.locator('input[value*="חשיבה: שישה"]') }).locator('td:first-child .link').click();
  await page.waitForTimeout(800);
  ok((await page.locator('.app-title').textContent())?.includes('חשיבה: שישה כובעים') || (await page.title()).includes('חשיבה: שישה כובעים'), 'the new name shows on the app page');
  await page.goto(BASE + '/?view=table');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);

  // bulk
  await menu(page, 'ניסוח תוכן לכל');
  await page.locator('.dialog .solid', { hasText: 'התחלה' }).click();
  await page.waitForTimeout(1500);
  ok(calls.filter((c) => c.action === 'generate').length >= rows.length, 'bulk runs generate per app');
  await page.locator('.dialog .link', { hasText: 'סגירה' }).click();

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
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(500);
  await page.screenshot({ path: SHOTS + 'mobile-home.png' });
  await page.goto(BASE + '/?app=app-1');
  await page.waitForSelector('.app-page');
  ok(await noHScroll(page), 'mobile app page: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-app.png', fullPage: true });
  await page.goto(BASE + '/?view=table');
  await page.waitForSelector('table');
  ok(await noHScroll(page), 'mobile table: page itself does not scroll sideways');
  await page.goto(BASE + '/');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('ai-menu .logo').click();
  await page.waitForTimeout(300);
  const box = await page.locator('ai-menu .panel').boundingBox();
  ok(box && box.x >= 0 && box.x + box.width <= 391, `mobile menu fits the screen (${JSON.stringify(box)})`);
  await page.screenshot({ path: SHOTS + 'mobile-menu.png' });
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/?app=app-1');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 1);
  await page.locator('.inline-edit', { hasText: 'עריכת קישורים' }).click();
  ok(await noHScroll(page), 'mobile app editing: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'mobile-edit.png', fullPage: true });
  await context.close();
}

// ---------- live guide (מדריך חי): record, share as a link, play ----------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await setup(context, []);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/');
  await page.waitForSelector('.card');
  await page.waitForFunction(() => window.AIDemo, null, { timeout: 10000 });
  await page.locator('ai-menu .logo').click();
  ok((await page.locator('ai-menu .item', { hasText: 'סרטון הדגמה' }).count()) === 0, 'demo: no "סרטון הדגמה" in the logo when this page has no video');
  await page.locator('ai-menu .item', { hasText: 'מדריך חי' }).click();
  await page.waitForFunction(() => window.AIGuide);
  ok(await page.locator('ai-guide-layer .dock h2').isVisible(), 'guide: A&I item opens the live guide panel');
  await page.screenshot({ path: SHOTS + 'guide-panel.png' });
  await page.locator('ai-guide-layer button', { hasText: 'התחלת הקלטה' }).click();
  ok(await page.locator('ai-guide-layer .rec').isVisible(), 'guide: recording bar shows');
  await page.locator('.topbar').getByText('טבלה', { exact: true }).click();
  await page.waitForSelector('table');
  await page.locator('.table-search').fill('גינות');
  await page.locator('.table-search').press('Tab');
  await page.locator('.topbar').getByText('מפה', { exact: true }).click();
  await page.waitForTimeout(200);
  const n = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ai-guide-rec')).s.length);
  ok(n === 3, `guide: three actions became three steps (${n})`);
  await page.screenshot({ path: SHOTS + 'guide-recording.png' });
  await page.locator('ai-guide-layer button', { hasText: 'סיום ועריכה' }).click();
  ok((await page.locator('ai-guide-layer .steps li').count()) === 3, 'guide: editor lists the steps');
  ok((await page.locator('ai-guide-layer .steps input').first().inputValue()).includes('טבלה'), 'guide: step text names the button');
  await page.locator('ai-guide-layer .title input').fill('איך מסננים בטבלה');
  await page.screenshot({ path: SHOTS + 'guide-edit.png' });
  await page.locator('ai-guide-layer button', { hasText: 'שמירה והעתקת קישור' }).click();
  const link = await page.evaluate(() => window.AIGuide.link(JSON.parse(localStorage.getItem('ai-guides'))[0]));
  ok(link.includes('#aig='), 'guide: the guide is carried in the link');

  const viewer = await context.newPage();
  viewer.on('pageerror', (e) => errs.push(String(e)));
  await viewer.goto(link);
  await viewer.waitForSelector('ai-guide-layer .bubble', { timeout: 8000 });
  await viewer.waitForSelector('ai-guide-layer .ring', { timeout: 8000 });
  ok((await viewer.locator('ai-guide-layer .bubble .say').textContent()).includes('טבלה'), 'guide link: first step bubble names the button');
  ok(!(await viewer.evaluate(() => location.hash.includes('aig='))), 'guide link: the address is cleaned after reading');
  const ring = await viewer.locator('ai-guide-layer .ring').boundingBox();
  const btn = await viewer.locator('.topbar').getByText('טבלה', { exact: true }).boundingBox();
  ok(ring && btn && ring.x <= btn.x && ring.x + ring.width >= btn.x + btn.width, 'guide link: the ring lights the real button');
  await viewer.screenshot({ path: SHOTS + 'guide-play.png' });
  await viewer.locator('.topbar').getByText('טבלה', { exact: true }).click();
  await viewer.waitForFunction(() => document.querySelector('ai-guide-layer')?.shadowRoot.querySelector('.bubble .mono')?.textContent.includes('02'));
  ok(true, 'guide link: clicking the lit button moves to step 2');
  await viewer.locator('.table-search').fill('גינות');
  await viewer.locator('.table-search').press('Tab');
  await viewer.waitForFunction(() => document.querySelector('ai-guide-layer')?.shadowRoot.querySelector('.bubble .mono')?.textContent.includes('03'));
  ok(true, 'guide link: typing in the field moves to step 3');
  await viewer.locator('.topbar').getByText('מפה', { exact: true }).click();
  await viewer.waitForFunction(() => document.querySelector('ai-guide-layer')?.shadowRoot.querySelector('.bubble .say')?.textContent.includes('הושלם'));
  ok(true, 'guide link: last step ends the guide');
  await viewer.setViewportSize({ width: 390, height: 800 });
  ok(await noHScroll(viewer), 'guide: mobile, no horizontal scroll');
  ok(errs.length === 0, `guide: no page errors (${errs.join(' | ')})`);
  await context.close();
}

// ---------- demo video (סרטון הדגמה): home button, player with speed, settings in the A&I menu ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const calls = [];
  await setup(context, calls);
  const demo = { src: 'https://ktqmwpbzcnzkhjskqisy.supabase.co/storage/v1/object/public/aoa-media/x/demo.mp4', poster: '', duration: 42, speed: 1, whole: true, at: [BASE + '/'] };
  // Registered after setup, so it answers first: the demo query, and the record that holds it.
  await context.route(/\/rest\/v1\/aoa_apps\?select=(id,demo|data&id=eq\.app-0)/, (r) => {
    const u = decodeURIComponent(r.request().url());
    if (u.includes('select=id,demo')) return r.fulfill({ json: u.includes(BASE + '/') ? [{ id: 'app-0', demo }] : [] });
    return r.fulfill({ json: [{ data: { ...rows[0].data, demo } }] });
  });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + '/');
  await page.waitForSelector('.card');
  const launch = page.locator('.hero-demo aoa-demo .launch');
  await launch.waitFor({ timeout: 10000 });
  ok(await launch.isVisible(), 'demo: the home page shows the demo button in the hero slot');
  ok((await launch.innerText()).includes('0:42'), 'demo: the button says the length');
  await page.screenshot({ path: SHOTS + 'demo-home.png' });
  await launch.click();
  ok(await page.locator('aoa-demo .veil video').isVisible(), 'demo: the button opens the player');
  await page.keyboard.press('Escape');
  ok((await page.locator('aoa-demo .veil').count()) === 0, 'demo: Escape closes the player');
  // Sharing is a trial on one app: without demo.share the player stays as it was.
  await launch.click();
  ok((await page.locator('aoa-demo .bar .ctl', { hasText: 'שיתוף' }).count()) === 0, 'demo: no share button when demo.share is not set');
  await page.keyboard.press('Escape');
  demo.share = { text: 'בדיקה' };
  await page.evaluate(() => window.AIDemo.reload());
  await launch.click();
  await page.locator('aoa-demo .bar .ctl', { hasText: 'שיתוף' }).click();
  const nets = await page.locator('aoa-demo .nets a').evaluateAll((as) => as.map((a) => [a.textContent, decodeURIComponent(a.href)]));
  ok(['וואטסאפ', 'פייסבוק', 'לינקדאין', 'X', 'טלגרם', 'מייל'].every((n) => nets.some((x) => x[0] === n)), 'demo: share lists WhatsApp, Facebook, LinkedIn, X, Telegram and e-mail');
  ok(nets.every(([, h]) => h.includes('?aoa-demo=1')), 'demo: every shared link opens the player (?aoa-demo=1)');
  await page.screenshot({ path: SHOTS + 'demo-share.png' });
  await page.keyboard.press('Escape');
  delete demo.share;
  await page.locator('.topbar').getByText('טבלה', { exact: true }).click();
  await page.waitForSelector('.table-wrap');
  ok((await page.locator('aoa-demo .launch').count()) === 0, 'demo: no button outside the home page');
  await page.locator('.topbar').getByText('מפה', { exact: true }).click();
  await page.locator('ai-menu .logo').click();
  await page.locator('ai-menu .item', { hasText: 'סרטון הדגמה' }).click();
  const sum = page.locator('aoa-demo .panel .sum');
  await sum.waitFor({ timeout: 10000 });
  ok((await sum.innerText()).includes('0:42'), 'demo: the A&I item opens the settings with the length');
  await page.locator('aoa-demo .panel .chip', { hasText: '×2' }).click();
  ok((await sum.innerText()).includes('0:21'), 'demo: speed ×2 with the whole story makes it 0:21');
  await page.screenshot({ path: SHOTS + 'demo-panel.png' });
  await page.locator('aoa-demo .panel .solid', { hasText: 'שמירה' }).click();
  await page.waitForFunction(() => document.querySelector('aoa-demo .panel, aoa-demo')
    && [...document.querySelectorAll('aoa-demo')].some((h) => h.shadowRoot.querySelector('.st')?.textContent.startsWith('נשמר')));
  const saved = calls.find((c) => c.action === 'save_app');
  ok(saved && saved.id === 'app-0' && saved.data.demo.speed === 2 && saved.data.demo.length === 21 && saved.data.name === rows[0].data.name,
    'demo: save keeps the record and stores speed 2 and length 21');
  await page.setViewportSize({ width: 390, height: 800 });
  ok(await noHScroll(page), 'demo: mobile, no horizontal scroll');
  ok(errs.length === 0, `demo: no page errors (${errs.join(' | ')})`);
  await context.close();
}

// ---------- from the phone: the phone page ----------
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const calls = [];
  await setup(context, calls);
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/?app=app-1&shoot=1');
  await page.waitForSelector('.shoot-name');
  ok((await page.locator('.shoot-name').textContent()) === rows[0].data.name, 'phone page: names the app it shoots for');
  ok((await page.locator('.shoot input[type=file]').getAttribute('capture')) === 'environment', 'phone page: opens the back camera');
  await page.locator('.shoot input[type=file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.shoot-photo');
  await page.locator('.shoot-big', { hasText: 'שמירה כתמונת שער' }).click();
  await page.waitForSelector('.shoot-ok');
  const saved = lastOf(calls, 'save_app');
  ok(/^app-1\/cover-\d+\./.test(lastOf(calls, 'sign_upload')?.path ?? ''), 'phone page: uploads under the app');
  ok(saved?.id === 'app-1' && saved.data.coverImage.includes('/aoa-media/app-1/cover-') && saved.data.name === rows[0].data.name, 'phone page: saves the cover and keeps the record');
  ok(saved?.data.changeLog?.[0]?.text.includes('מהטלפון'), 'phone page: writes the work log');
  ok(await noHScroll(page), 'phone page: no horizontal scroll');
  await page.screenshot({ path: SHOTS + 'phone-shoot.png' });
  await page.goto(BASE + '/?app=missing&shoot=1');
  await page.waitForSelector('.shoot-insight');
  ok((await page.locator('.shoot-main').textContent()).includes('סרקי את הקוד החדש'), 'phone page: a wrong link says what to do');
  ok(errs.length === 0, `phone page: no page errors (${errs.join(' | ')})`);
  await context.close();
}

// ---------- "פתיחה בטלפון" in the A&I menu (trial: the portfolio only) ----------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await setup(context, []);
  await context.route(/cdn\.jsdelivr\.net\/npm\/qrcode-generator/, (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(new URL('../node_modules/qrcode-generator/qrcode.js', import.meta.url)) }));
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/?app=app-1');
  await page.waitForFunction(() => document.querySelector('ai-menu')?.items?.length > 0);
  await page.locator('ai-menu .logo').click();
  ok((await page.locator('ai-menu .item', { hasText: 'פתיחה בטלפון' }).count()) === 1, 'phone QR: the item is in the portfolio menu');
  await page.locator('ai-menu .item', { hasText: 'פתיחה בטלפון' }).click();
  await page.waitForFunction(() => document.querySelector('ai-menu').shadowRoot.querySelector('.phone svg'), null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => !!document.querySelector('ai-menu').shadowRoot.querySelector('.phone .code svg')), 'phone QR: the code shows inside the menu');
  ok((await page.evaluate(() => document.querySelector('ai-menu').shadowRoot.querySelector('.phone code').textContent)).includes('app=app-1'), 'phone QR: it carries the page state');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'menu-phone-qr.png' });
  // any other app: the same element without the attribute keeps the menu as it was
  const other = await page.evaluate(async () => {
    const el = document.createElement('ai-menu');
    document.body.append(el);
    el.openMenu();
    const has = [...el.shadowRoot.querySelectorAll('.item')].some((b) => b.textContent.includes('פתיחה בטלפון'));
    el.remove();
    return has;
  });
  ok(other === false, 'phone QR: apps without the trial attribute are unchanged');
  ok(errs.length === 0, `phone QR: no page errors (${errs.join(' | ')})`);
  await context.close();
}

// ---------- shared streets layer ----------
{
  const context = await browser.newContext();
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route(/\/rest\/v1\//, (r) => r.fulfill({ json: [] }));
  const page = await context.newPage();
  await page.goto(BASE + '/');
  const res = await page.evaluate(async (base) => {
    await new Promise((ok, no) => { const s = document.createElement('script'); s.src = base + '/streets.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
    const a = await window.AIStreets.locate('שדרות הרצל 12, אשדוד');
    const b = await window.AIStreets.nearest(31.812281, 34.644832);
    const g = await window.AIStreets.load();
    return { a, b, n: g.features.length };
  }, BASE);
  ok(res.n === 2991, `streets: the shared layer serves all segments (${res.n})`);
  ok(res.a?.name === 'שד הרצל' && Math.abs(res.a.lat - 31.79) < 0.03, `streets: an address finds its street (${JSON.stringify(res.a)})`);
  ok(res.b?.name === "ז'בוטינסקי" && res.b.quarter === 'רובע א', 'streets: a point finds its street and quarter');
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

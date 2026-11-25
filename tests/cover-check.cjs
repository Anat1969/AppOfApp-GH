// בדיקת כריכה לכל אפליקציה: node tests/cover-check.cjs https://app.vercel.app/ [--cover-js=path]
// הכריכה במסך אחד בלי גלילה (במחשב), שלוש שורות הייקו, חזון, מטרה, "פתיחה" שמוביל לדף קיים, ושיתוף.
const { chromium } = require('playwright');
const url = process.argv[2];
const local = (process.argv.find((a) => a.startsWith('--cover-js=')) || '').split('=')[1];
if (!url) { console.error('usage: node tests/cover-check.cjs <url>'); process.exit(2); }
(async () => {
  const b = await chromium.launch();
  const fails = [];
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); };
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const p = await b.newPage({ viewport: vp });
    if (local) await p.route('**/cover.js', (r) => r.fulfill({ path: local, contentType: 'application/javascript' }));
    await p.goto(url, { waitUntil: 'networkidle' });
    const c = p.locator('app-cover');
    await c.locator('[data-cover]').waitFor({ timeout: 10000 }).catch(() => {});
    ok(await c.locator('[data-cover]').count() === 1, `${vp.width}: יש כריכה`);
    ok(await c.locator('[data-haiku] span').count() === 3, `${vp.width}: הייקו בשלוש שורות`);
    ok(await c.locator('[data-vision]').count() === 1 && await c.locator('[data-goal]').count() === 1, `${vp.width}: חזון ומטרה`);
    ok(await c.locator('[data-share]').count() === 1, `${vp.width}: כפתור שיתוף`);
    if (vp.width > 860) ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), `${vp.width}: הכריכה במסך אחד, בלי גלילה`);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${vp.width}: בלי גלילה אופקית`);
    const before = p.url();
    await c.locator('[data-open]').click();
    await p.waitForTimeout(600);
    ok(p.url() !== before && !(await p.locator('app-cover [data-cover]').count()), `${vp.width}: "פתיחה" מוביל לדף אחר`);
    await p.close();
  }
  await b.close();
  console.log(fails.length ? `\n${fails.length} נכשלו` : '\nהכריכה תקינה');
  process.exit(fails.length ? 1 : 0);
})();

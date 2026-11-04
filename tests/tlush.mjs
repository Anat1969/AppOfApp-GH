// End-to-end check of the payslip reader (tlush/) against `vite preview`.
// Synthetic slips only: never commit a real payslip. Run: npm run build && (npx vite preview --port 4173 &) && node tests/tlush.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };

const slip = (month, bank) => ({
  id: `2026-${String(month).padStart(2, '0')}`, year: 2026, month, slipNo: '1',
  summary: { base: 20000, additions: 0, overtime: 0, expenses: 500, otherPay: 0, gross: 20500, diffs: 0, totalPay: 20500, mandatory: 5000, net: 15500, personalDed: 20, fundsDed: 1900, bank },
  payments: [{ code: '1', name: 'שכר יסוד', amount: 20000, section: 'שכר יסוד' }, { code: '42', name: 'תשלום אש"ל', amount: 500, section: 'החזר הוצאות' }],
  mandatory: [{ code: '91003', name: 'מס הכנסה', amount: 3500, section: 'ניכויי חובה' }, { code: '91001', name: 'ביטוח לאומי', amount: 900, section: 'ניכויי חובה' }, { code: '92041', name: 'ביטוח בריאות', amount: 600, section: 'ניכויי חובה' }],
  personal: [{ code: '1616', name: 'ביטוח חיים', amount: 20, section: 'ניכוים אישיים' }],
  funds: [{ code: '31491', name: 'קה"ש מגדל', amount: 500, section: 'קופות גמל', pct: 2.5, base: 20000 }, { code: '33671', name: 'מבטחים החד', amount: 1400, section: 'קופות גמל', pct: 7, base: 20000 }],
  aux: [{ code: '31492', name: 'הפרשה קה"ש מ', amount: 1500, section: 'נתוני עזר', pct: 7.5 }, { code: '33672', name: 'הפרשה מבטחים', amount: 1500, section: 'נתוני עזר', pct: 7.5 },
    { code: '33673', name: 'הפרשת פיצ מבט', amount: 1666, section: 'נתוני עזר', pct: 8.33 }, { code: '163', name: 'רכב צמוד לחישוב', amount: 3000, section: 'נתוני עזר' }],
  info: { creditPoints: 2.75, marginalTax: 31, birthDate: '01/01/1970', startDate: '01/01/2020', family: 'נשואה', dayValue: 900, hourValue: 115 },
  vacation: { open: 20, credit: 2, used: 1, close: 21 }, sick: { open: 100, credit: 1.5, used: 0, close: 101.5 },
  cumulative: { grossTax: 20500 * month, annualTax: 3500 * month }, warnings: [],
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/supabase\.co|vercel\.app/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${BASE}/tlush/`);
ok(await page.locator('.upload').isVisible(), 'empty state shows the upload area');
ok(await page.locator('button:has-text("העלאת כל התלושים")').first().isVisible(), 'main button: upload all slips');
// A PDF that is not a payslip, and a non-PDF, go through the same pipeline and are reported, not swallowed.
const pdfPage = await ctx.newPage();
await pdfPage.setContent('<p>not a payslip</p>');
const notSlip = await pdfPage.pdf();
await pdfPage.close();
await page.setInputFiles('[data-testid=slip-files]', [{ name: 'other.pdf', mimeType: 'application/pdf', buffer: notSlip }, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
await page.waitForSelector('.jobs li.error', { timeout: 15000 });
ok((await page.textContent('.jobs')).includes('פירוט תשלומים'), 'a non-payslip PDF says why it was not read');
ok((await page.textContent('.jobs-box')).includes('דילגתי') || (await page.textContent('.jobs-box')).includes('לא קובצי PDF'), 'a non-PDF file is skipped and reported');
ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
await page.evaluate((s) => localStorage.setItem('tlush-slips-v1', JSON.stringify(s)), [slip(1, 13580), slip(2, 13600), slip(4, 13700)]);
await page.reload();
ok(await page.locator('.map').isVisible(), 'the map of slips is on the home page');
ok((await page.textContent('.map-head')).includes('מרץ 2026'), 'the map names the missing month');
ok((await page.locator('.map-grid .cell.on').count()) === 3, 'three loaded cells on the map');
await page.locator('.map-grid .cell.on').first().click();
ok(page.url().includes('m=2026-01'), 'a map cell opens its slip');
await page.goto(`${BASE}/tlush/`);
ok((await page.textContent('.kpis')).includes('3'), 'home counts three slips');
for (const [label, expect] of [['מה יש בתלוש', 'מהברוטו לבנק'], ['הכנסות והוצאות', 'מכל 100'], ['מה מגיע לי', 'נקודות זיכוי'], ['איפה לחסוך', 'דמי ניהול'], ['פנסיה', 'איך הקצבה תחולק'], ['תכנון זמן', 'ציר זמן']]) {
  await page.click(`.nav-btn:has-text("${label}")`);
  await page.waitForTimeout(350);
  ok(await page.locator('.page-title button:has-text("העלאת כל התלושים")').isVisible(), `${label}: upload button in the page head`);
  ok((await page.textContent('main')).includes(expect), `${label}: shows "${expect}"`);
  await page.screenshot({ path: `${SHOTS}tlush-${label.replace(/\s/g, '-')}.png`, fullPage: true });
}
await page.click('.nav-btn:has-text("פנסיה")');
const before = await page.textContent('.sec .kpis');
await page.locator('.field input').first().fill('500000');
await page.waitForTimeout(200);
ok((await page.textContent('.sec .kpis')) !== before, 'a balance changes the forecast');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tlush-params-v1') || '{}'));
ok(Object.values(stored.balances || {}).includes(500000), 'parameters are saved on the device');

const phone = await ctx.newPage();
await phone.setViewportSize({ width: 375, height: 780 });
for (const v of ['', '?v=slip', '?v=flow', '?v=pension', '?v=time', '?v=owed', '?v=save']) {
  await phone.goto(`${BASE}/tlush/${v}`);
  await phone.waitForTimeout(300);
  ok((await phone.evaluate(() => document.documentElement.scrollWidth)) <= 375, `mobile ${v || 'home'}: no horizontal scroll`);
}
ok(!errors.length, `no page errors ${errors.join(' | ')}`);
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);

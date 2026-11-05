// Shared test helpers: serve vite preview, stub the shared ai-menu and the network.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const MENU = fs.readFileSync(path.join(__dirname, 'ai-menu.js'), 'utf8');
let fails = 0, passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log('  ok', m); } else { fails++; console.log('  FAIL', m); } };
async function open(url, opts = {}, stub) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (r) => {
    const u = r.request().url();
    if (u.includes('ai-menu.js')) return r.fulfill({ body: MENU, contentType: 'application/javascript' });
    if (u.startsWith('http://localhost')) return r.continue();
    if (stub) { const s = stub(u); if (s) return r.fulfill(s); }
    return r.fulfill({ status: 503, body: '' });
  });
  await page.goto(url);
  return { browser, page, errors };
}
const done = () => { console.log(`\n${passes} passed, ${fails} failed`); process.exit(fails ? 1 : 0); };
async function fit(page) { return page.evaluate(() => ({ ratio: +(document.documentElement.scrollHeight / innerHeight).toFixed(2), hscroll: document.documentElement.scrollWidth > innerWidth + 1 })); }
module.exports = { ok, open, done, fit };

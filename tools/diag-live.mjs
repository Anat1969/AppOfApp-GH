// Temporary diagnosis: click every home section tab on the live site with real data.
import { chromium } from 'playwright';
const url = process.argv[2] || 'https://appofapp-gh.vercel.app/';
const b = await chromium.launch();
for (const vp of [{ width: 1720, height: 1300 }, { width: 1366, height: 768 }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(8000);
  const state = async () => JSON.stringify({ url: p.url().replace(url, ''), on: await p.locator('.sec-bar button.on').textContent().catch(() => null), h2: (await p.locator('.sec-body h2').allTextContents()).join('/'), body: (await p.locator('#root').innerText()).length });
  const hit = () => p.evaluate(() => [...document.querySelectorAll('.sec-bar button')].map((b) => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return b.textContent.trim().slice(0, 14) + ':' + (top === b || b.contains(top) ? 'OK' : `${top?.tagName}.${top?.className}#${top?.id} in ${top?.parentElement?.tagName}.${top?.parentElement?.className}`); }).join(' | '));
  console.log('VIEWPORT', vp.width, 'start', await state());
  console.log('HIT', await hit());
  for (const t of ['מפת', 'כל הגיליונות', 'סינתזות', 'מגזין', 'חדש בתיק']) {
    try {
      await p.locator('.sec-bar button', { hasText: t }).click({ timeout: 4000 });
      await p.waitForTimeout(1200);
      console.log('CLICK', t, await state());
    } catch (e) { console.log('CLICK', t, 'FAIL', e.message.split('\n').slice(0, 10).join(' | ')); }
  }
  await p.screenshot({ path: `diag-${vp.width}.png` });
  await p.close();
}
await b.close();

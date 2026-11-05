// החורים בתיק: live data with snapshot fallback, the Nolli grid, domain panel, human check of matches, prompt, phone.
const { ok, open, done, fit } = require('./e2e-lib.cjs');
const fs = require('fs'); const path = require('path');
const URL = process.env.URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS;
const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/apps-snapshot.json'), 'utf8'));
// the live API answers with {id, data}: two extra apps prove the live path is used
const liveRows = [...snap, { id: 'x1', n: 'מעבדת כימיה', a: 'diagnose', k: ['כימיה'], c: [], t: '', u: null }, { id: 'x2', n: 'מחול עירוני', a: 'create', k: ['מחול'], c: [], t: '', u: null }]
  .map((a) => ({ id: a.id, data: { name: a.n, originalName: a.on, action: a.a, domains: a.d, keywords: a.k, concepts: a.c, desc: a.t, previewUrl: a.u } }));
const stub = (u) => (u.includes('/rest/v1/aoa_apps') ? { status: 200, contentType: 'application/json', body: JSON.stringify(liveRows) } : null);
(async () => {
  const { browser, page, errors } = await open(URL, {}, stub);
  await page.waitForSelector('.n-row');
  await page.waitForSelector('.src-state.s-live');
  ok((await page.locator('.src-state').innerText()).includes('141'), 'live portfolio replaces the snapshot');
  ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
  ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
  ok((await page.locator('.n-row').count()) === 14, '14 knowledge domains');
  ok((await page.locator('.n-cell').count()) === 98, '14 x 7 cells');
  ok((await page.locator('.rank-row').count()) > 3, 'holes ranked in the side column');
  const f = await fit(page); ok(f.ratio <= 1 && !f.hscroll, `desktop fits ${JSON.stringify(f)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-map.png` });
  await page.locator('.rank-row').first().click();
  ok(await page.locator('.side-h').isVisible(), 'a ranked hole opens its domain');
  ok(/d=/.test(page.url()), 'selection is in the address');
  ok((await page.locator('.anchors li').count()) === 3, 'three discoveries to build on, with sources');
  ok((await page.locator('.prompt').innerText()).includes('anat-app-builder'), 'ready prompt for Claude Code');
  await page.locator('.n-col').nth(0).click();
  ok((await page.locator('.n-cell.is-mute').count()) === 14 * 6, 'a column header highlights one action');
  await page.locator('.n-col').nth(0).click();
  // human check: reject a match and see precision move
  await page.locator('.n-row').filter({ hasText: 'אדריכלות' }).locator('.n-name').click();
  const firstBuilt = page.locator('.p-actions .chip.has').first(); await firstBuilt.click();
  const before = await page.locator('.hit').count();
  await page.locator('.hit .link-btn').first().click();
  ok((await page.locator('.hit').count()) === before - 1, 'rejecting a match removes it');
  ok(/%/.test(await page.locator('.kpi').nth(3).locator('.kpi-v').innerText()), 'mapping precision is measured from the human check');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-panel.png` });
  await page.reload(); await page.waitForSelector('.n-row');
  ok(/%/.test(await page.locator('.kpi').nth(3).locator('.kpi-v').innerText()), 'the check survives a reload');
  await page.locator('button[aria-label="איך זה עובד"]').click();
  ok(await page.locator('.dlg >> text=Nolli').isVisible(), 'method dialog'); await page.keyboard.press('Escape');
  ok(errors.length === 0, `no page errors ${errors.join('|')}`);
  await browser.close();

  const off = await open(URL, {}, null);
  await off.page.waitForSelector('.src-state.s-snapshot');
  ok((await off.page.locator('.src-state').innerText()).includes('139'), 'offline: falls back to the snapshot and says so');
  await off.browser.close();

  const mob = await open(URL, { viewport: { width: 390, height: 844 }, reduced: true }, stub);
  await mob.page.waitForSelector('.n-row');
  const fm = await fit(mob.page); ok(!fm.hscroll, `phone: no horizontal scroll ${JSON.stringify(fm)}`);
  if (SHOTS) await mob.page.screenshot({ path: `${SHOTS}/mob.png` });
  const cdp = await mob.page.context().newCDPSession(mob.page);
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(() => ({ installabilityErrors: [] }));
  ok(!inst.installabilityErrors.filter((e) => !/service-worker|in-incognito/.test(e.errorId)).length, `installable ${JSON.stringify(inst.installabilityErrors.map((e) => e.errorId))}`);
  await mob.browser.close();
  done();
})();

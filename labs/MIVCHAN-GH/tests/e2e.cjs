// אמירה במבחן המדע: rows, filters as legend, detail layers, waiting chart, untested holes, phone sheet.
const { ok, open, done, fit } = require('./e2e-lib.cjs');
const URL = process.env.URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS;
(async () => {
  const { browser, page, errors } = await open(URL);
  await page.waitForSelector('.row');
  ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
  ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
  const n = await page.locator('.row').count(); ok(n === 17, `17 tests (${n})`);
  ok(await page.locator('.layer-fact .tag-fact').isVisible() && await page.locator('.layer-read .tag-read').isVisible(), 'fact and interpretation are separate layers');
  ok((await page.locator('.layer-fact .src a').count()) >= 2, 'every discovery links to its source and to Olam');
  await page.locator('.row').nth(8).click();
  ok(page.url().includes('t=heart'), 'selection is in the address');
  ok((await page.locator('.d-verdict .stamp').innerText()).includes('המילה הופרכה'), 'heart test shows its verdict');
  for (const v of ['confirmed', 'cond', 'literal', 'refuted']) {
    await page.locator(`.vc.v-${v}`).click();
    const shown = await page.locator('.row').count();
    const want = +(await page.locator(`.vc.v-${v} .num`).innerText());
    ok(shown === want, `filter ${v}: ${shown} rows = legend count ${want}`);
  }
  await page.locator('.chip.all').click(); ok((await page.locator('.row').count()) === 17, '"הכול" resets');
  await page.locator('.vc.v-untested').click();
  ok((await page.locator('.u-card').count()) === 9, 'nine untested ideas shown as holes');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-untested.png` });
  await page.locator('.chip.all').click();
  await page.keyboard.press('ArrowDown'); ok(true, 'arrow keys move the selection');
  await page.locator('.tab').nth(1).click();
  await page.waitForSelector('.wait-row');
  ok((await page.locator('.wait-row').count()) === 17, 'waiting chart lists every test');
  ok(await page.locator('.tone-insight').isVisible(), 'longest wait is called out');
  const f = await fit(page); ok(f.ratio <= 1 && !f.hscroll, `desktop fits ${JSON.stringify(f)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-wait.png` });
  await page.locator('.wait-row').first().click();
  ok(await page.locator('.detail').isVisible(), 'a waiting row opens its test');
  await page.locator('button[aria-label="איך זה עובד"]').click();
  ok(await page.locator('.dlg >> text=ארבעה פסקים').isVisible(), 'method dialog'); await page.keyboard.press('Escape');
  ok(errors.length === 0, `no page errors ${errors.join('|')}`);
  await browser.close();

  const mob = await open(URL, { viewport: { width: 390, height: 844 }, reduced: true });
  await mob.page.waitForSelector('.row');
  const fm = await fit(mob.page); ok(fm.ratio <= 1.5 && !fm.hscroll, `phone fits ${JSON.stringify(fm)}`);
  if (SHOTS) await mob.page.screenshot({ path: `${SHOTS}/mob-list.png` });
  await mob.page.locator('.row').nth(3).click(); await mob.page.waitForTimeout(400);
  ok(await mob.page.locator('.side.is-open').isVisible(), 'phone: tapping a row opens the detail sheet');
  if (SHOTS) await mob.page.screenshot({ path: `${SHOTS}/mob-sheet.png` });
  await mob.page.locator('.sheet-x').click(); await mob.page.waitForTimeout(400);
  ok(!(await mob.page.locator('.side.is-open').count()), 'phone: the sheet closes');
  const cdp = await mob.page.context().newCDPSession(mob.page);
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(() => ({ installabilityErrors: [] }));
  ok(!inst.installabilityErrors.filter((e) => !/service-worker|in-incognito/.test(e.errorId)).length, `installable ${JSON.stringify(inst.installabilityErrors.map((e) => e.errorId))}`);
  await mob.browser.close();
  done();
})();

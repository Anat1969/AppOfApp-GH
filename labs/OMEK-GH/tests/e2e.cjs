// מד עומק ידע: every button, a full round, the map, persistence, phone, reduced motion. Run against `npm run preview`.
const { ok, open, done, fit } = require('./e2e-lib.cjs');
const URL = process.env.URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS;
(async () => {
  const { browser, page, errors } = await open(URL);
  await page.waitForSelector('.q-title');
  ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
  ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
  ok((await page.locator('.opt').count()) === 4, 'four options');
  ok(await page.locator('.conf-btn').first().isDisabled(), 'confidence waits for an answer');
  const total = +(await page.locator('.q-meta .label .num').nth(1).innerText());
  ok(total === 14, `a round is one question per domain (${total})`);
  for (let k = 0; k < total; k++) {
    await page.locator('.opt').nth(k % 4).click();
    await page.locator(`.conf-btn.c${(k % 3) + 1}`).click();
    await page.waitForSelector('.verdict');
    if (k === 0) {
      ok(await page.locator('.fact .src a').first().getAttribute('href').then((h) => !!h && h.startsWith('http')), 'every answer shows its source link');
      ok((await page.locator('.opt.is-right').count()) === 1, 'the right answer is marked');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-answer.png` });
    }
    await page.locator('.next').click();
  }
  await page.waitForSelector('.chart');
  ok(page.url().includes('#/map'), 'round ends on the depth map');
  ok((await page.locator('.cell').count()) === 14, '14 domain cells');
  ok((await page.locator('.cell[data-empty="false"]').count()) === 14, 'every domain measured after one round');
  const f = await fit(page); ok(f.ratio <= 1.0 && !f.hscroll, `desktop map fits the screen ${JSON.stringify(f)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-map.png` });
  await page.locator('.cell').first().click();
  ok(await page.locator('.side-h').isVisible(), 'clicking a domain opens its side panel');
  await page.locator('.side .btn.dark').first().click();
  ok((await page.locator('.q-meta .label').innerText()).includes('מתוך'), 'focused round starts from the panel');
  const focused = +(await page.locator('.q-meta .label .num').nth(1).innerText());
  ok(focused >= 5, `focused round has ${focused} questions`);
  await page.locator('button[aria-label="השיטה והאמינות"]').click();
  ok(await page.locator('.dlg >> text=Gardner-Medwin').isVisible(), 'method dialog names the standard');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('.dlg').isVisible().catch(() => false)), 'Esc closes the dialog');
  await page.keyboard.press('2'); ok(await page.locator('.opt[aria-pressed="true"]').count() === 1, 'number keys pick an answer');
  await page.reload(); await page.waitForSelector('.q-title');
  ok((await page.locator('.tab-n').innerText()).trim() === String(total), 'answers survive a reload');
  ok(errors.length === 0, `no page errors ${errors.join('|')}`);
  await browser.close();

  const mob = await open(URL + '#/map', { viewport: { width: 390, height: 844 }, reduced: true });
  await mob.page.waitForSelector('.chart');
  const fm = await fit(mob.page); ok(!fm.hscroll, `phone: no horizontal scroll ${JSON.stringify(fm)}`);
  if (SHOTS) await mob.page.screenshot({ path: `${SHOTS}/mob-map.png`, fullPage: false });
  await mob.page.locator('.tab').first().click(); await mob.page.waitForSelector('.q-title');
  const fq = await fit(mob.page); ok(!fq.hscroll && fq.ratio <= 1.6, `phone question fits ${JSON.stringify(fq)}`);
  if (SHOTS) await mob.page.screenshot({ path: `${SHOTS}/mob-q.png` });
  const cdp = await mob.page.context().newCDPSession(mob.page);
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(() => ({ installabilityErrors: [] }));
  ok(!inst.installabilityErrors.filter((e) => !/service-worker|no-matching-service-worker|in-incognito/.test(e.errorId)).length, `installable ${JSON.stringify(inst.installabilityErrors.map((e) => e.errorId))}`);
  await mob.browser.close();
  done();
})();

// מייצא כל יצירה ב-creations.json לקובץ JPG (1240×1754, A4 ב-150dpi, איכות 88), מתוך הרכיב <app-creations> עצמו.
// הרצה מתוך ריפו של אפליקציה, מול vite preview:
//   node creations-render.cjs <כתובת דף היצירות> <נתיב creations.json> [תיקיית פלט]
//   node creations-render.cjs "http://localhost:4173/#/creations" public/creations.json public/creations
// עם --articles: כתבה אחת לכל נושא (?cr-article=<id>), ל-<תיקיית פלט>/articles/<id>.jpg, והנתיב נרשם בשדה article של הנושא.
// כתובת עם hash: הסקריפט מוסיף ?cr=<topic>/<id> לפני ה-hash. הפלט נרשם בשדה png של כל יצירה (השם נשמר מסיבות תאימות, הקובץ JPG).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const ARTICLES = args.includes('--articles');
const [page0, jsonPath, outDir = path.join(path.dirname(jsonPath || '.'), 'creations')] = args.filter((a) => a !== '--articles');
if (!page0 || !jsonPath) { console.error('usage: creations-render.cjs <page-url> <creations.json> [out-dir]'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const withCr = (key, param = 'cr') => { const u = new URL(page0); u.searchParams.set(param, key); return u.href; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
  // ai-menu ושאר משאבים חיצוניים שלא נגישים מהסביבה לא עוצרים את הצילום
  await p.route('**/ai-menu.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const local = process.env.CREATIONS_JS;
  if (local) await p.route('**/creations.js', (r) => r.fulfill({ path: local, contentType: 'application/javascript' }));
  let n = 0;
  if (ARTICLES) {
    const dir = path.join(outDir, 'articles');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of data.topics) {
      await p.goto(withCr(t.id, 'cr-article'), { waitUntil: 'networkidle' });
      await p.waitForSelector('.cr-shot-stage[data-ready="1"] .ar-sheet', { timeout: 30000 });
      const el = p.locator('.cr-shot-stage .ar-sheet');
      await el.screenshot({ path: path.join(dir, `${t.id}.jpg`), type: 'jpeg', quality: 88 });
      if ((await el.getAttribute('data-fit')) === 'over') console.log('גלישה בכתבה:', t.id);
      t.article = path.relative(path.dirname(jsonPath), path.join(dir, `${t.id}.jpg`)).split(path.sep).join('/');
      n++;
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
    await b.close();
    console.log(`${n} כתבות יוצאו ל-${dir}`);
    return;
  }
  for (const t of data.topics) for (const c of t.creations) {
    const key = `${t.id}/${c.id}`;
    await p.goto(withCr(key), { waitUntil: 'networkidle' });
    await p.waitForSelector('.cr-shot-stage[data-ready="1"] .cr-card', { timeout: 30000 });
    const file = `${t.id}-${c.id}.jpg`;
    await p.locator('.cr-shot-stage .cr-card').screenshot({ path: path.join(outDir, file), type: 'jpeg', quality: 88 });
    const fit = await p.locator('.cr-shot-stage .cr-card').getAttribute('data-fit');
    if (fit === 'over') console.log('גלישה: הטקסט ארוך מדי גם בגודל המינימלי', key);
    c.png = path.relative(path.dirname(jsonPath), path.join(outDir, file)).split(path.sep).join('/');
    n++;
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
  await b.close();
  console.log(`${n} יצירות יוצאו ל-${outDir}`);
})();

# CLAUDE.md

## Communication

- Always answer Anat in Hebrew. No icons or emoji, also not in the UI (no decorative arrows).
- Work by the end-to-end-builder skill. Merge every PR to `main` after green checks without asking: Anat gave standing approval.
- ALWAYS MERGE AND DEPLOY (Anat, 2026-11-04: "סיכמנו שאתה תמיד ממזג ופורס. כל שיחה כל פרויקט"): at the end of every task,
  in every conversation and every project, merge to `main` and check the deployment right away. Never leave work waiting
  for a night window and never ask whether to merge. This replaces the deploy windows below for ordinary work.
- Delivery: final URL plus one line. Every correction Anat makes is added to this file.

## Service quotas (Anat's correction, 2026-10-24)

On 2026-10-24 a run across ~90 repos used up Vercel's free limit of 100 deployments per day in the
middle of her workday, and she could not deploy anything else. She was not warned beforehand.
- Before any bulk job, estimate how much of each quota it will use: Vercel deployments, including
  the preview deploy for every PR; Supabase; API credits; and the paid subscriptions. Tell Anat the
  number and the risk in one line before starting.
- A job that would use more than about half of a daily quota is scheduled for a quiet day or hour,
  or split across days. Cut usage first: skip preview deploys, merge in batches, and deploy only the
  latest commit of each project.
- DEPLOY WINDOWS (2026-10-26) are only for BULK jobs across many projects (they would use more than about half of the
  daily 100): those run at 01:00 / 03:00 Israel time. Single tasks are merged and deployed at once (see Communication).
  Branches `claude/*` make no Vercel preview (`vercel.json` git.deploymentEnabled); previews are screenshots.
- MUNICIPAL ACCOUNT DEPLOYS AT ONCE (Anat, 2026-11-04: "כל עוד אני עובדת בחשבון העירוני - תפרוס"): while she works from
  her municipal account (anatdavids@ashdod.muni.il), finished and tested work is merged to `main` and deployed right away,
  not held for the night windows. The quota estimate before bulk jobs still applies.
- Free and paid quotas are used deliberately: on days she is not working, use spare capacity for
  heavy jobs. Keep a reserve on days she is working.

## What this is

APPOFAPP-GH: Anat's app portfolio (109 apps, 21 categories). Upgraded on 2026-10-24 from the Lovable project
"Craft Your Story" (create-your-spark-068.lovable.app, Lovable Cloud project pqwubzdbzddoiwkgmwxg).
The data, categories and 72 images were copied into cultura-GH. The Lovable app still runs on its old data
and is no longer the source of truth.

## Stack

Vite + React 18 + TypeScript + framer-motion + fuse.js. Plain CSS (`src/styles.css`), Hebrew RTL,
IBM Plex Sans Hebrew / IBM Plex Mono. Deployed on Vercel (project appofapp-gh) from `main`:
https://appofapp-gh.vercel.app

```bash
npm run dev
npm run build
npx vite preview --port 4173 & node tests/e2e.mjs   # Playwright, every Supabase call mocked
```

Second address (Anat, 2026-10-24: "קישור ישיר לאפ דרך גיטהב"): GitHub Pages at
https://anat1969.github.io/AppOfApp-GH/ , built by `.github/workflows/pages.yml` on every push to main
(branch `gh-pages`, `BASE_PATH=/AppOfApp-GH/`). It does not use the Vercel quota, so it stays current when
Vercel is rate-limited. Keep every path relative or based on `import.meta.env.BASE_URL`; never a bare `/`.

Branch hygiene (2026-10-27, two broken builds): after a squash merge, restart `claude/zealous-shannon-mz9acg` from
`origin/main`; when the remote branch has old history, record it with `git merge -s ours` (never `-X ours`, which
mixed old lines back in: duplicated functions in `aoa-edit`, an unused import that failed `tsc -b` on Pages and Vercel).
Run `npm run build` again after every merge, right before pushing.

Playwright comes from the global install: `ln -s "$(npm root -g)/playwright" node_modules/playwright`.

## Payslip reader (`tlush/`, Anat 2026-11-04)

"מה יש בתלוש שלי": https://appofapp-gh.vercel.app/tlush/ (and on Pages `/AppOfApp-GH/tlush/`). Anat's own app (not municipal).
Second Vite entry (`tlush/index.html`, code `src/tlush/`). Her vision: what is on the slip, income and deductions, what she
is owed, where to save, the pension and how it splits, how to time things to get more.
- PRIVACY FIRST: payslips hold her ID, bank account and address. PDFs are read in the browser with pdf.js
  (`src/tlush/pdf.ts`); slips and parameters live only in localStorage (`tlush-slips-v1`, `tlush-params-v1`). No server, no
  Supabase, no AI call, never a real slip in the repo or in tests (`tests/tlush.mjs` uses synthetic slips). Backup and restore
  as a JSON file from the A&I menu; the sw skips `/tlush/`; the page is noindex.
- Parser `src/tlush/parse.ts` reads Malam payroll ("מלם שכר") slips by text position: summary bar under its labels,
  detail rows by code and section header, the right panel (credit points, tax rate, "נתוני עזר" employer deposits,
  vacation and sick balances, cumulative). Checked on her May 2026 slip: every line adds up to the summary. A locked PDF
  asks for its password.
- Calculations `src/tlush/calc.ts` are estimates and say so: 2026 tax brackets, credit point 242, pension in today's
  shekels (return, fees, coefficient 205, retirement age 65, 67% exemption of the 9,430 ceiling, old-age allowance 1,800),
  every assumption editable on the pension page. Without the current fund balances the forecast counts only future deposits
  and the page says so in red.
- UPLOAD ALL AND MAP (Anat, 2026-11-04: "כפתור בו אני מעלה את כל התלושים שיש לי ואתה ממפה אותם"): "העלאת כל התלושים"
  (many PDFs) and "בחירת תיקייה שלמה" (webkitdirectory) on the home page and in the head of every page; drag and drop too.
  One shared uploader (`UploaderProvider` in `src/tlush/Upload.tsx`) reads the files one by one and lists each result
  (read, replaced the same month, not a payslip, locked, skipped non-PDF). `SlipMap.tsx` maps every slip by year x month:
  loaded (to the bank / gross), just uploaded, needs a check, missing (the current year counts from January); a cell opens
  the slip. The pension forecast uses the last 12 slips. Share link: https://appofapp-gh.vercel.app/s/app-tlush-reader
- Vacation and sick units are not printed on the slip: a days / hours switch on "מה מגיע לי".

## Quality bar: MOKED106 (Anat, 2026-11-04: "תסתכל על האפליקציה של מוקד כדי להבין מה רמת הציפייה שלי בעיצוב, בשפה, בסכמה, בפיצ'רים, בניקיון גרפיקה")

Reference: Anat1969/MOKED106-GH (`transparency/index.html` public page, `app/templates/index.html` dashboard). Every app is
measured against it:
- SCHEMA: the user's questions are the structure. Three answers at the top (question, big number, one line), then numbered
  sections whose titles are questions ("עמדו בהבטחה?"), a sticky index of the sections, and a closing "איך מודדים".
- LANGUAGE: plain words of the person using it, never system terms; every chart and table has a computed insight sentence
  under its title; every section ends with its source ("מקור: ...").
- HONESTY: a benchmark next to every number (a bar with a gold target tick, red below it); real data vs estimate or demo
  is visibly different (dashed line, hollow point, "הערכה" / "הדגמה" tag); a consistency check is shown as a badge
  ("בדיקת התאמה") and explained; privacy and limits are written in the app.
- FEATURES: trend over 12 months per line (sparkline), change from the previous month, sort and filter toggles, a map or
  grid when there is a place or time axis, two audiences when relevant (management dashboard + public page).
- GRAPHICS: two colours (navy #1a3a6f, gold #d4af37) on warm white #f8f6f1 and white cards, one red #a23b2a for problems
  only; bold headings (800) and big bold numbers; quiet shadows; generous white space; 17px body. Square corners and no
  icons stay (Anat's standing rules), even though MOKED uses rounded pills and thin line icons.
Applied first to the payslip reader (2026-11-04).
- READING ORDER AND CONTROLS (Anat, 2026-11-04, for every app):
  "כל סרגל כפתורים צריך להיות קבוע בדף בו הוא מצוי - בלי קפיצות - מאבדים אוריינטציה": every button bar is sticky in its
  page and never moves: one band under the top bar holds the page's controls (in the payslip reader `.band` + `Band` portal
  in `src/tlush/ui.tsx`); page changes fade without vertical motion; a month switch keeps the scroll position.
  "יותר שימוש ברמזור צבעים": green = good for the user, red = out / below target, amber = check; navy = savings, gold = targets.
  "כפתורים באותם גדלים, ללא מסגרות, כן ריחוף והצללה והבלטה של הלחוץ": one button size (40px), no borders, lift and shadow on
  hover, the pressed one filled navy and set in.
  Line charts with points, axes, every month, isolate a line on click (the others fade) and its average as a dashed line
  (`src/tlush/Chart.tsx`); "כל גרף - ההסבר שלו והתובנות שעולות ממנו": every chart has "איך לקרוא" and "מה רואים" (computed).
  Income opposite expenses and gross next to net, side by side. "סדר את המידע ... מסיכום לפרוט": top-down from summary to
  detail. A "כללי אצבע" page: each rule, the user's number against it and a traffic light, red first.
  "תאפשר לראות את הגרפים גם אחד מעל השני": every line chart has "יחד" / "אחד מעל השני" (each figure on its own scale and
  average). The home page has one chart of all summary figures with buttons: "תמונת מצב" (one month or the average, every
  figure as a bar, sort by type or size) and "לאורך השנה" (pick the figures, compare the months) (`src/tlush/Dashboard.tsx`).
  "אני רוצה את השורה התחתונה": the home page opens with "השורה התחתונה", what everything means in one sentence, three
  points in traffic-light colours and the one next step (`BottomLine`).
  Round 3 (Anat, 2026-11-04): "לעלות מסמכים - בחלון הלוגו שלי": upload ("העלאת כל התלושים", "בחירת תיקייה שלמה") lives in the
  A&I menu (`MenuBridge`), files can be dropped anywhere on the page; the first-run page keeps its upload box. Text never
  leaves its frame: an audit walks every text node of every card on every page at 1280 and 390 (scratchpad
  `overflow.cjs`, to be turned into a test). Grid and alignment regardless of text length: fixed label columns, cards in
  a row share a height and an inner grid (title, number at the bottom, note), amounts never wrap. "אחרי נקודה שורה חדשה":
  `M` puts every sentence on its own line. "אותו מידע בשורה ובתור ולא מפוצל": a value and its unit stay together.
  Know, understand, act: every page ends with "מה עושים עכשיו?" (`NextSteps`). Hierarchy: the home page goes bottom line,
  answers, one chart, map, doors; the duplicate KPI row was removed. Picking figures: chosen ones pressed, "+ הוספה" for
  more, "איפוס" back to the default.

## Data (Supabase cultura-GH, ktqmwpbzcnzkhjskqisy, shared: prefix `aoa_`)

| Table / bucket | Purpose |
|---|---|
| `aoa_apps` | `id` + `data` jsonb in the original AppData shape (`src/lib/types.ts`) |
| `aoa_categories` | legacy Lovable categories, kept in `data.category` but no longer shown |
| `aoa_facets` | controlled vocabulary: `kind` (domain / context), `value`, `label`, `synonyms[]`, `position` |
| `aoa_editor_keys` | sha256 of editor keys (unused since 2026-10-29) |
| `aoa_admins` | admin emails (for a future Supabase session) |
| `aoa-media` | public bucket, covers and logos (`<appId>/cover-<ts>.<ext>`) |

RLS: public read on apps and categories, no write policies. Every write goes through the edge function
`aoa-edit` (source in `supabase/functions/aoa-edit`), which writes with the service role (open to every device, see Editing). Actions: check, ai_status (which AI keys are set, true/false only, and whether Poe answers), save_app, delete_app, save_category, delete_category, save_facet, delete_facet, sign_upload,
generate.

## Editing

EDITING IS OPEN ON EVERY DEVICE (Anat, 2026-10-29, explicit approval in the session: "ביקשתי שלא יהיה צריך קישור
סיסמא או מה שלא יהיה לצורך עריכה! ... אני רוצה זרימה בעבודה ולא משנה מאיפה אני מתחברת"). No editor link, key, sign-in
or device connection anywhere: `aoa-edit` has no editor check, the A&I menu always shows the editing actions, the add form
saves at once. Never bring back a link or key step. Protection is the safety net below, not a gate.
`aoa_editor_keys` and `aoa_admins` are left in the database, unused.
Safety net in `aoa-edit`: the previous version of an app goes to `aoa_app_versions` before a save (at most one
per app every 10 minutes); a delete moves the app to `aoa_trash` (action `restore_app`); deleted categories and facets go there too as
`category:<value>` / `facet:<kind>:<value>`. Both tables are public
read, written by the function only. Migration: `supabase/migrations/20261024_aoa_versions_trash.sql`.

TEXT STANDARD (Anat, 2026-10-26, "חשוב ביותר", for every app and every AI connection): every text an AI writes is
distilled and emphasized in a hierarchy: an insight line of up to 8 words, one explanation sentence of up to 20 words,
and `**` on the main concept, the parameters and the numbers. The paste-ready instruction is in `docs/ai-text-standard.md`;
`GEN_SYSTEM` in `aoa-edit` is identical to it. Gemini free first, Claude only as a fallback.
Gemini (2026-10-27): Anat's key starts with `AQ.` (the newer Google key format, works). Free models answer 503 or slowly at
times, so `aoa-edit` tries `gemini-flash-latest`, then lighter models, 25s each. The model answers each field as
{insight, detail} and the server joins them, so the hierarchy is kept every time.
`generate` (Anat, 2026-10-26: "חינמי") reads the app's own site (title, meta, headings) so the model does not
invent, then asks Gemini first (`GEMINI_API_KEY`, free tier, model `GEMINI_MODEL` default `gemini-flash-latest`)
and falls back to Claude (`ANTHROPIC_API_KEY`, returned 401 since 2026-10-24). Without a Gemini key the error says
how to add one. POE (Anat, 2026-11-03, from a reel on free chatbots, poe.com): the second link in the chain, Gemini, then Poe, then
Claude. `POE_API_KEY` (from poe.com/api_key) pays from the account's free daily points (about 3,000 a day, not officially
documented) through the OpenAI-compatible `api.poe.com/v1`; bot `POE_MODEL`, default `Claude-Haiku-4.5`, then cheaper bots.
It reaches Claude without the 401 Anthropic key. Without the secret the step is skipped.
Checked 2026-11-03 with action `ai_status`: the key is set and Poe answers 402 (insufficient_points). The free plan
gives no points the API can use; the API needs the paid plan (about $5 a month, 10,000 points a day). Until Anat decides,
Gemini keeps writing and the Poe step stops at once on 402, without delay.
The 67 apps that still had Lovable placeholders were filled once by hand from name, keywords and
site meta: `supabase/migrations/20261026_aoa_fill_texts.sql`.

## UI rules

- A&I LOGO BUTTON (Anat's standing rule, repeated many times): the top bar holds only the app name (links
  home), search, map/table, and ONE logo button "אד' ענת שטיבלמן A&I". Every editing and development action
  lives only inside it: מצב עריכה, אפליקציה חדשה, ניסוח, העתקת קישור (copies the full
  state: `?app=`, `?cat=`, `?q=`, `?view=table`, `?links=1`), שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה.
  No floating editor bar, no loose buttons. The component is `public/ai-menu.js`, served to all of Anat's apps
  from https://appofapp-gh.vercel.app/ai-menu.js; React wrapper `src/components/AIMenu.tsx`.
  Standard and paste-ready skill text: `docs/ai-menu-standard.md`. The e2e test fails without it.
- REMOVING AN APP (Anat, 2026-11-02: "ביטול אפליקציה באדום בסוף הכפתורים שבלוגו שלי - בזהירות כי זה לא קורה הרבה וזה
  מסוכן"): "ביטול האפליקציה" is the last item of the A&I menu, red, alone in a group "פעולה מסוכנת", only on an app page
  (`danger: true` items in `ai-menu.js`). It only opens `RemoveAppDialog`: the button stays locked until the app's name is
  typed exactly; the app goes to `aoa_trash`, and the toast that follows has "שחזור" (`restore_app`). No delete button
  anywhere else.
- LIVE GUIDE (2026-11-03, from a reel on the Tango extension that Anat sent): the A&I menu has "מדריך חי". It records
  every click and field as a step, lets her reword the steps, and carries the whole guide in the link (`#aig=`, no server,
  no quota). Opening the link lights the next button with an amber ring and a bubble, and moves on when it is clicked;
  it continues across pages (sessionStorage) and inside the A&I menu (shadow host). Also a printable page. Code
  `public/guide.js`, loaded only on use; it is served next to `ai-menu.js`, so every app with the A&I button has it.
- DEMO VIDEO (Anat, 2026-11-03: "כפתור המחבר לסרטון שאתה תייצר שיתמקם בדף הבית. סרטון קצר שניתן לקבוע אורך ומהירות"):
  the A&I menu (and the Ashdod one) has "סרטון הדגמה" in every app. The app's video and settings live in `aoa_apps`
  `data.demo` = { src, poster, duration, speed, length, whole, at[] }; `at` lists the page addresses that show the button.
  Length and speed are applied at playback, never burned into the file, so a change shows at once with no render and
  no deployment. "כל הסיפור" (default) ties them: length = duration / speed, so the closing card is always seen; off,
  the ending is cut and the panel says so. The button mounts in `[data-aoa-demo]` (here: the hero, `large`); an app
  whose `<html>` has `data-aoa-demo-slots` shows it only where a slot is, any other app gets it in the corner.
  The panel also copies a ready request to Claude for a new video at the chosen length. Video: `templates/demo.cjs`
  in Claude-GH, file in `aoa-media/<appId>/demo-<ts>.mp4`. Code `public/demo.js`, loaded by `ai-menu.js` after idle.
  This app is recorded in its own portfolio as `app-appofapp-gh` (it was missing until 2026-11-03).
  The item shows in the logo only where the page has a video (`AIDemo.has()`, Anat approved 2026-11-03); a new app gets
  its video from Claude first, tried on one app (Refua-GH) before any change reaches all apps.
  SHARING (Anat, 2026-11-03: "דאג שתהיה אפשרות לשתף את הסרטון ברשתות"), trial on one app (PrasNovel-GH): only when
  `data.demo.share` = { text } is set, the player gets "שיתוף": the device's share sheet (with the file when allowed), WhatsApp,
  Facebook, LinkedIn, X, Telegram, e-mail, copy link, and download (Instagram and TikTok take a file). The shared link is the
  page with `?aoa-demo=1`, which opens the player on arrival; the app's own og: tags give the network preview. Without
  `share` the player is unchanged. Download names are ASCII (`<host>-demo.mp4`): Chromium turns a Hebrew name into "download".
- CREATIONS (Anat, 2026-11-03: "כל אפליקציה צריכה דף עם כתבות שהיא יכולה להפיק מנושאים שעולים מהידע, הבנה ויישום"):
  `public/creations.js` serves `<app-creations src="./creations.json">` to all apps (Pages first, Vercel fallback). Each topic
  is a room with creations in nine designs (poster, gradient, veil, insight, quote, haiku, post, fromto, essay), A4 sheets
  sized in `--u` (cqw), fitted so text never leaves the frame. Print one creation or a room as A4; "העלאה לחדר בתערוכה"
  opens TAARUCHA `/studio/import`. JPG export: `tools/creations-render.cjs`. Standard: `docs/creations-standard.md`.
  First five apps: Amirot, Refua, Tzuna, PrasNovel, Olam.
  04.11.2026, ענת: "כפתור 'הכל' לא יכול להראות כמו כפתור ידע, הבנה, יישום". ידע, הבנה ויישום הם כפתורי שלב עם סמל קו
  ומספר חדרים; "הכול" הוא קישור טקסט שקט בסוף השורה. לחיצה לא משאירה מסגרת: טבעת מיקוד רק במקלדת (`:focus-visible`).
- WALK AT EYE HEIGHT (2026-11-03, from a reel on spaceplanner.co, Anat approved): `public/walk.js` serves `<space-walk>` to all
  her apps, like `ai-menu.js`. A plan (JSON, meters) becomes 3D and a first-person walk at a chosen eye height (95 child,
  120 seated, 160 standing), with a live count of what blocks the view and a plan map with a legend. three.js 0.160 is
  imported from jsdelivr on use. Standard: `docs/walk-standard.md`. First use: Urban 95 (`Anat1969/-95`, route `/walk`).
  Apps load it from Pages first (https://anat1969.github.io/AppOfApp-GH/walk.js) and Vercel second: on 2026-11-03 Vercel
  served an older walk.js while rate-limited, it loaded without error and the fallback never ran. Uses: Urban 95,
  building-percentage exercise (targil2), Outline-plan compliant (AshdodMitar, `?view=walk`), skyscraper (SkySkiper-GH).
  Every shared script must be listed in the rewrite exception in `vercel.json` (walk.js and demo.js were missing and came
  back as index.html). The `gh-pages` output carries a vercel.json with git deployments off: each Pages push used to start a
  Vercel build that failed and still counted toward the daily 100 (found 2026-11-03, the day the quota ran out).
- OPEN ON THE PHONE (2026-11-03, Anat: "בצע 1, 2, 3", tools bank): `<ai-menu phone>` adds "פתיחה בטלפון" to the sharing
  group: a QR of the current page with its state, opened in place under the item. The encoder (qrcode-generator 1.4.4 from
  jsdelivr) loads only on use. ON TRIAL: only this portfolio sets `phone` (`AIMenu.tsx`); every other app's menu is
  unchanged until Anat approves making it the default. Standard: `docs/ai-menu-standard.md`.
- ASHDOD STREETS (2026-11-03): `public/streets.js` (`AIStreets.nearest`, `locate`, `load`) and
  `public/gis/ashdod-streets.geojson`, the municipality street layer (2,991 segments, WGS84) shared by all municipal apps,
  loaded from Pages first. Original shapefile and converter: SHIMUR-GH `data/gis/rehovot/`. Standard: `docs/streets-standard.md`.
- SHARE LINK WITH A PICTURE (Anat, 2026-11-04: on WhatsApp only some app links showed the app's image): a preview needs
  og: tags and a small image; most apps have no tags, and 39 of 100 covers are PNGs over 250KB (up to 2.3MB), which WhatsApp
  drops. So the link to send is the portfolio's `https://appofapp-gh.vercel.app/s/<id>` (`src/lib/share.ts`): Vercel
  function `api/share.js` answers link-preview robots with og: tags (name, insight line, image) and sends people on to the
  app with a 302; `api/og.js` (sharp) turns the cover into a 1200x630 JPEG of about 20-120KB, or a screenshot of the site
  when there is no cover, or the A&I icon. Copied by "העתקת קישור עם תמונה" next to the enter button on the app page and
  by "העתקה" in the table. Always the Vercel address (Pages cannot run functions). The share HTML is never cached at the
  edge (same address, two answers); the image URL carries `v=` from the cover, so a new cover gives a new picture.
- Sheet numbers (A-001...) follow creation order.
- CLASSIFICATION (Anat, 2026-10-24): every app sits on four axes, stored in `data`:
  `action` (exactly one of 7, fixed in `src/lib/facets.ts`: אבחון ומדידה, יצירה, חקירה ולמידה, ניהול ומעקב,
  השראה, הוראה והצגה, משחק ואימון; rule: what the user walks away with), `domains[]` and `contexts[]`
  (vocabulary in `aoa_facets`, editable in edit mode with synonyms), `keywords[]` (free).
  The word "כלי" is not a category: it is a synonym of diagnose and create.
- Names carry no prefixes ("פנג שואי", not "כלי מדידה: פנג שואי"); the action label is shown above the name.
  The old name is kept in `originalName` and is searchable. Initial classification of all 109 apps:
  `supabase/migrations/20261024_aoa_classify_apps.sql`.
- Finding: search covers name, old name, keywords, text and the vocabulary with synonyms (`src/lib/search.ts`);
  the empty search box explains what can be searched; filters by the three axes combine in the address
  (`?action=`, `?domain=`, `?ctx=`); the home matrix is domain x action and shows empty cells as gaps;
  every app page lists related apps (`related()` in `src/lib/facets.ts`).
- LIVE SEARCH (Anat liked it, keep it): typing shows a live grid of app thumbnails in the search panel that
  narrows with every word (each word must match, `$and` in `src/lib/search.ts`), highlights the typed text,
  and says which vocabulary entries widened the search. Empty box shows the search help.
  A grey X at the end of the field (Anat, 2026-11-01) resets the search and the filters it set; it shows only when
  there is something to reset.
- ADDING AN APP is a primary purpose (Anat, 2026-10-24): a prominent "הוספת אפליקציה חדשה" button in the hero,
  in the catalog header, in empty search results and in every map cell. It is a content action, so it lives in
  the page, not in the top bar (the A&I rule still holds there). The form saves on every device, no link (see Editing).
- SEARCH BY MEANING (Anat, 2026-10-24: "משכורת" must find "תלושי שכר"): every app has hidden `data.concepts`
  (everyday words, synonyms, English; seeded in `supabase/migrations/20261024_aoa_concepts.sql`). Search strips
  Hebrew prefixes (ה ו ב ל מ ש כ), says on each card which word found it ("נמצא דרך"), and when nothing matches
  shows the closest apps. When adding an app, add concepts too: the words a person who forgot its name would type.
- MAP CELLS: hovering a cell opens a window listing its apps one per line; the name links straight to the app,
  the sheet number opens its page. Hover intent (Anat, 2026-10-28, "לפעמים הוא שולח אותי לאפליקציה אחרת"): crossing other
  cells on the way to the window never switches it; it switches only after the pointer rests 280ms on another cell, never
  while the pointer is inside it, and a clicked window stays; the window that is leaving takes no clicks. Every empty cell holds a suggested app (`src/data/gapIdeas.ts`), the apps it
  can build on (same row and column), "הוספה לתיק מהרעיון" (prefilled dialog) and a ready Claude Code prompt.
- READING AT A GLANCE (Anat, 2026-10-26: "בעיה באדום פתרון בירוק"): meaning has a colour. Problem red (underline
  stroke), solution green (marker), description yellow marker; panels numbered 01 / 02 with "ולכן" between;
  numbers become figures, "label:" becomes a short heading, list lines become numbered steps; every card on the home
  page shows the two insight lines. On the app page problem and solution appear once, in the panels under the image
  (Anat, 2026-10-27: "למה צריך בעיה ופתרון פעמיים?", the essence strip under the description was removed).
  Combination she chose: the app page is full colour (tinted panels), home and cards stay light.
- EMPHASIS IN TEXTS (Anat, 2026-10-24): in the description, problem and solution the first sentence is an insight
  line (larger), `**words**` render as a highlighter mark, and when a text has no markers the app's own keywords,
  concepts and domain labels found in it are emphasized automatically (up to three). In edit mode every text
  field has a "הדגשה" button that wraps the selection in `**` (`RichText.tsx`, `MarkedTextarea.tsx`).
- TABLE (Anat, 2026-10-27; reworked 2026-11-04): a big "עודכן" column (`data.updatedAt`, with "היום / לפני N ימים"), default
  sort newest first. Sorting any column colours that column only by group with a legend; dates group BY DAY ("תאריכים שונים
  באותו צבע"): one colour per calendar day. The whole table fits the screen width (fixed column widths, text wraps; under
  1100px it scrolls inside its frame). Every header has drawn sort arrows; the sorted header is dark with an amber line.
  Next to the name a thumbnail opens the app; the project name sits under the name; the sheet number opens the app page.
  Platforms, code and database are icons (favicons), all column names are Hebrew (מסד נתונים, קוד, ממשק).
  EDIT WHILE VIEWING ("האם חייב להפריד בין עריכה לתצוגה?"): the table has no edit mode. Every cell is a field that looks like
  text; Enter or leaving it saves at once (the store's autosave) and the cell flashes green; Escape restores. Link cells show
  the short name and the full address on focus. A saved row keeps its place until the sort, filter or app count changes.
  RENAME: the name lives once in `data.name`; the page title follows when it equalled the old name, and the first old name
  stays in `originalName` for search.
- DOMAINS IN HEBREW (2026-11-04): five domain values had no vocabulary entry and showed in English. New domains health
  (בריאות וגוף) and knowledge (ידע ורעיונות); the rest moved (`supabase/migrations/20261104_aoa_hebrew_domains.sql`).
  `facetLabel` never shows a raw English key ("לא מסווג").
- HOME IN THREE SCREENS (2026-11-04): 01 "חדש בתיק" in two columns, added (by creation date) and updated (changed after the
  day it was added), last 30 days; 02 the map, sized so all domain rows fit one screen (`--rows`); 03 all sheets. Each starts
  a screen of its own with a double rule between. The hero line is Hebrew.
- COVER IMAGE (Anat, 2026-10-27): the frame takes the image's own proportions (a screenshot is never cropped; very tall
  ones are limited to 82vh and the frame narrows to them). In edit mode a screenshot pasted anywhere on the app page
  (Ctrl+V, unless text is pasted into a field) becomes the cover, shows at once as a preview, and uploads once even if
  pasted again while uploading. A pasted image address is used as is.
- FROM THE PHONE (Anat, 2026-11-03, "פעל בהתאם להמלצה", tool 2 in Claude-GH `docs/tools-bank.md`, from a reel on
  PairDrop): in edit mode the cover has "מהטלפון" next to "בחירת קובץ". It opens a QR code to this app's own address with
  `?app=<id>&shoot=1` (`src/lib/phone.ts`). The phone page (`PhoneShoot.tsx`, rendered instead of the portfolio) has one big
  button that opens the back camera, shrinks the photo on the phone itself (tool 1: longest side 2000px, JPEG 85%, shows
  the sizes), uploads it with `sign_upload`, reads the app again and saves it with the new cover and a work-log line. No
  sign-in, no pairing code (editing is open on every device). The computer reads the app every 3s while the QR is open
  (up to 15 minutes, no realtime channel, so it works on Pages too) and shows the new cover with `receiveApp`, which
  does not save again and keeps an edit still on its way.
- DIALOGS ON BODY (2026-11-03): `Dialog.tsx` renders through a portal on `<body>`. Inside `.app-visual` (perspective) a
  fixed dialog was pinned to the cover frame instead of the screen.
- The test PNG in `tests/e2e.mjs` is a broken file (inflate error): images in tests never render, so a visual check needs
  a real image.
- ONE ACTION PER IMAGE (Anat, 2026-10-29: clicking the cover "מתבלבל עם מעבר לאפליקציה אחרת"): the cover on the app page
  only opens the app, and says so on the frame at all times (a bar "פתיחת האפליקציה" + the address; touch has no hover).
  Paging to other apps is never next to the image: it sits at the foot of the page, names the previous and next app, and says
  which list it pages through ("N מתוך M" + search results / whole portfolio by date or by name, the catalog's own order).
- NO AUTOFILL, LINK CHECK (Anat, 2026-11-01, floating buttons over text boxes and covers opening another app): Chrome
  autofill offered addresses typed for one app in the fields of another; every input and textarea gets
  autocomplete="off" (`src/main.tsx`, also for fields added later). In edit mode the app link shows a live picture of
  the address the cover and the button open, and a red warning when another app has the same address.
- EDIT MODE IS LIT (Anat, 2026-10-27): an amber frame around the screen while editing, pulsing while saving, red while a
  save is retried; the tag on it says every change is saved automatically. There is no save button: each edit is saved
  online after a pause, a failed save is kept on the device (`aoa-pending-edits`) and retried (2s, 5s, 15s, then 30s),
  and closing the tab with an unsaved change asks first. The A&I status shows "נשמר HH:MM".
- WHERE AM I (Anat, 2026-10-27, chose "ב + ג"): the portfolio is framed like a drawing sheet (double border around the
  screen) with a title stamp at the bottom left ("תיק האפליקציות", the current view or sheet number, "A&I · אד׳ ענת
  שטיבלמן"), under a dark blue top bar with an amber line. Only the portfolio has these; do not copy them into the apps.
- Square buttons, chips and fields (anat-app-builder), including the shared A&I button.
- OWNER AND LOGO (Anat, 2026-10-27): every app is either the municipality's or hers. `data.owner = "ashdod"` marks the
  39 municipal apps she ticked (the rest are hers). Municipal apps use `<ai-menu brand="ashdod">`, which shows the Ashdod
  Municipality logo (`public/ashdod-logo.png`, complete, transparent, approved by her) with the same menu inside.
  At the start of every build, ask her whose app it is.
- Placeholder text from the old Lovable template ("תאר את...") is treated as empty and never shown.

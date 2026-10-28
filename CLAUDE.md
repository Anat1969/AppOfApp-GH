# CLAUDE.md

## Communication

- Always answer Anat in Hebrew. No icons or emoji, also not in the UI (no decorative arrows).
- Work by the end-to-end-builder skill. Merge every PR to `main` after green checks without asking: Anat gave standing approval.
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
- DEPLOY WINDOWS (Anat, 2026-10-26: "פרוס בשלוש בבוקר ושעתיים לפני ניצול מכסת הפריסות"): work is merged to `main`
  only in two night windows, Israel time: 01:00 (uses what is left before the 24-hour count rolls over) and 03:00
  (the new count). A scheduled task in the development session does it: tests, merge, check Vercel and Pages, one
  Hebrew line. During her day nothing is deployed unless she asks, so the quota is always free for her work.
  Branches `claude/*` make no Vercel preview (`vercel.json` git.deploymentEnabled); previews are screenshots.
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

## Data (Supabase cultura-GH, ktqmwpbzcnzkhjskqisy, shared: prefix `aoa_`)

| Table / bucket | Purpose |
|---|---|
| `aoa_apps` | `id` + `data` jsonb in the original AppData shape (`src/lib/types.ts`) |
| `aoa_categories` | legacy Lovable categories, kept in `data.category` but no longer shown |
| `aoa_facets` | controlled vocabulary: `kind` (domain / context), `value`, `label`, `synonyms[]`, `position` |
| `aoa_editor_keys` | sha256 of editor keys |
| `aoa_admins` | admin emails (for a future Supabase session) |
| `aoa-media` | public bucket, covers and logos (`<appId>/cover-<ts>.<ext>`) |

RLS: public read on apps and categories, no write policies. Every write goes through the edge function
`aoa-edit` (source in `supabase/functions/aoa-edit`), which checks the `x-editor-key` header and writes with
the service role. Actions: check, save_app, delete_app, save_category, delete_category, save_facet, delete_facet, sign_upload,
generate.

## Editing

Google sign-in is off in cultura-GH, and email sign-in returns to another app's Site URL, so editing works
by a personal editor link: `https://<site>/#editor=<KEY>`, or by pasting that link in the A&I menu
("חיבור המכשיר לעריכה"). The key is kept in localStorage and removed from the address. The editing actions
appear in the A&I menu only for a valid key.
New key: generate a random string, insert its sha256 into `aoa_editor_keys`.
Anat chose this over open editing (2026-10-24, option ב): the add form always opens; on a device not yet
connected one field for the editor link appears above the save button and is used once. A connected device can
copy the link from the A&I menu ("העתקת קישור העריכה") to connect another device. Open editing for everyone was
requested first and blocked by the Claude Code safety check; do not remove the key check without her explicit
approval in the session.
Saving must not depend on localStorage (Anat, 2026-10-24, "אתה פשוט מרגיז אותי"): on anat1969.github.io all her
apps share one localStorage, the link check passed and the save got 403. The key is kept in memory too, the add
dialog passes the pasted key straight to the save, and a refused save shows the link field again with the form intact.
Safety net in `aoa-edit`: the previous version of an app goes to `aoa_app_versions` before a save (at most one
per app every 10 minutes); a delete moves the app to `aoa_trash` (action `restore_app`). Both tables are public
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
how to add one. The 67 apps that still had Lovable placeholders were filled once by hand from name, keywords and
site meta: `supabase/migrations/20261026_aoa_fill_texts.sql`.

## UI rules

- A&I LOGO BUTTON (Anat's standing rule, repeated many times): the top bar holds only the app name (links
  home), search, map/table, and ONE logo button "אד' ענת שטיבלמן A&I". Every editing and development action
  lives only inside it: מצב עריכה, אפליקציה חדשה, ניסוח, חיבור/ניתוק מכשיר, העתקת קישור (copies the full
  state: `?app=`, `?cat=`, `?q=`, `?view=table`, `?links=1`), שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה.
  No floating editor bar, no loose buttons. The component is `public/ai-menu.js`, served to all of Anat's apps
  from https://appofapp-gh.vercel.app/ai-menu.js; React wrapper `src/components/AIMenu.tsx`.
  Standard and paste-ready skill text: `docs/ai-menu-standard.md`. The e2e test fails without it.
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
- ADDING AN APP is a primary purpose (Anat, 2026-10-24): a prominent "הוספת אפליקציה חדשה" button in the hero,
  in the catalog header, in empty search results and in every map cell. It is a content action, so it lives in
  the page, not in the top bar (the A&I rule still holds there). The form always opens; on a device not yet
  connected one editor-link field sits above the save button (see Editing).
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
- TABLE (Anat, 2026-10-27): a big "עודכן" column (the date she last changed the app, `data.updatedAt`, with "היום / לפני N
  ימים"), default sort newest first. Sorting any column colours that column only by group (dates by age, links by
  present/missing, labels by value) with a legend above the table.
- RENAME IN THE TABLE (Anat, 2026-10-27, consistent names by subject): in edit mode the name cell is a field (Enter or
  leaving it saves). The name lives once in `data.name`, so every page shows the new one; the page title follows when it
  equalled the old name, and the first old name stays in `originalName` for search. "פתיחה" next to it opens the app.
- COVER IMAGE (Anat, 2026-10-27): the frame takes the image's own proportions (a screenshot is never cropped; very tall
  ones are limited to 82vh and the frame narrows to them). In edit mode a screenshot pasted anywhere on the app page
  (Ctrl+V, unless text is pasted into a field) becomes the cover, shows at once as a preview, and uploads once even if
  pasted again while uploading. A pasted image address is used as is.
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

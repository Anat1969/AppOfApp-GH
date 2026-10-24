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

`generate` uses Claude (`ANTHROPIC_API_KEY` secret of cultura-GH). On 2026-10-24 that key returned 401;
the UI shows a clear error until the secret is replaced.

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
  the page, not in the top bar (the A&I rule still holds there). On a device not yet connected, the dialog first
  asks for the editor link, then shows the form.
- SEARCH BY MEANING (Anat, 2026-10-24: "משכורת" must find "תלושי שכר"): every app has hidden `data.concepts`
  (everyday words, synonyms, English; seeded in `supabase/migrations/20261024_aoa_concepts.sql`). Search strips
  Hebrew prefixes (ה ו ב ל מ ש כ), says on each card which word found it ("נמצא דרך"), and when nothing matches
  shows the closest apps. When adding an app, add concepts too: the words a person who forgot its name would type.
- MAP CELLS: hovering a cell opens a window listing its apps one per line; the name links straight to the app,
  the sheet number opens its page. Every empty cell holds a suggested app (`src/data/gapIdeas.ts`), the apps it
  can build on (same row and column), "הוספה לתיק מהרעיון" (prefilled dialog) and a ready Claude Code prompt.
- EMPHASIS IN TEXTS (Anat, 2026-10-24): in the description, problem and solution the first sentence is an insight
  line (larger), `**words**` render as a highlighter mark, and when a text has no markers the app's own keywords,
  concepts and domain labels found in it are emphasized automatically (up to three). In edit mode every text
  field has a "הדגשה" button that wraps the selection in `**` (`RichText.tsx`, `MarkedTextarea.tsx`).
- Square buttons, chips and fields (anat-app-builder), including the shared A&I button.
- Placeholder text from the old Lovable template ("תאר את...") is treated as empty and never shown.

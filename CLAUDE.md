# CLAUDE.md

## Communication

- Always answer Anat in Hebrew. No icons or emoji, also not in the UI (no decorative arrows).
- Work by the end-to-end-builder skill. Merge every PR to `main` after green checks without asking: Anat gave standing approval.
- Delivery: final URL plus one line. Every correction Anat makes is added to this file.

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
- Placeholder text from the old Lovable template ("תאר את...") is treated as empty and never shown.

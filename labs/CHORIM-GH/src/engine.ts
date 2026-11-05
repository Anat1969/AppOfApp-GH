import OLAM from './data/olam-lite.json';
import SNAP from './data/apps-snapshot.json';

export type Domain = { id: string; he: string; en: string; family: string; familyHe: string; color: string; subs: { id: string; he: string }[] };
export type Disc = { id: string; t: string; y: number; dm: string; sub: string; who: string[]; nov: string; src: { t: string; u: string } };
export type App = { id: string; n: string; on?: string | null; a: string | null; d: string[] | null; k: string[] | null; c: string[] | null; t: string; u: string | null };

export const DOMAINS = OLAM.domains as Domain[];
export const DISCS = OLAM.discoveries as Disc[];
export const SNAPSHOT = SNAP as App[];
export const SNAPSHOT_DATE = '05.11.2026';

/** The seven actions of the portfolio (AppOfApp `src/lib/facets.ts`). Newer columns fold into "אחר". */
export const ACTIONS = [
  { id: 'diagnose', he: 'אבחון ומדידה' },
  { id: 'create', he: 'יצירה' },
  { id: 'explore', he: 'חקירה ולמידה' },
  { id: 'manage', he: 'ניהול ומעקב' },
  { id: 'inspire', he: 'השראה' },
  { id: 'teach', he: 'הוראה והצגה' },
  { id: 'play', he: 'משחק ואימון' },
  { id: 'other', he: 'זיקוק, החלטה ואחר' },
] as const;
export const actionOf = (a: string | null) => (ACTIONS.some((x) => x.id === a) ? a! : 'other');

/**
 * The bridge between the two vocabularies: which words in an app say it touches a domain of the discoveries archive.
 * Transparent on purpose: every match on screen shows the word that made it.
 */
export const LEXICON: Record<string, string[]> = {
  religion: ['דת', 'יהדות', 'תנ"ך', 'תנך', 'תנ״ך', 'תנכי', 'תנכיים', 'תורה', 'גמרא', 'תלמוד', 'משנה', 'חסידות', 'קבלה', 'תפילה', 'פרשה', 'פרשת', 'מקרא', 'הלכה', 'קודש', 'bible', 'torah', 'judaism', 'religion'],
  philosophy: ['פילוסופיה', 'פילוסוף', 'אתיקה', 'מוסר', 'ערכים', 'לוגיקה', 'סוקרטס', 'פרד"ס', 'פרדס', 'חוכמה', 'אמירות', 'פתגמים', 'ציטוטים', 'philosophy', 'ethics'],
  psychology: ['פסיכולוגיה', 'פסיכולוגי', 'רגש', 'רגשות', 'אישיות', 'זיהוי עצמי', 'מודעות', 'nlp', 'קואצ\'ינג', 'אימון אישי', 'מוטיבציה', 'נפש', 'זיכרון', 'קשב', 'התנהגות', 'טיפול באמנות', 'טיפול באומנות', 'טיפול רגשי', 'מטפל', 'מטופל', 'תרפיה', 'אינטליגנציה', 'אינטליגנציות', 'psychology', 'therapy', 'כובעי חשיבה', 'חשיבה'],
  mathematics: ['מתמטיקה', 'מתמטי', 'גאומטריה', 'גיאומטריה', 'אלגברה', 'הסתברות', 'סטטיסטיקה', 'פרקטל', 'פרקטלים', 'יחס הזהב', 'משוואה', 'משוואות', 'פונקציה', 'סימטריה', 'math', 'geometry', 'פסיכומטרי', 'כמותי'],
  physics: ['פיזיקה', 'אסטרונומיה', 'אסטרופיזיקה', 'קרינה', 'אקוסטיקה', 'תאורה', 'אור טבעי', 'הצללה', 'אנרגיה סולארית', 'קרינת שמש', 'physics', 'solar', 'אופטיקה'],
  chemistry: ['כימיה', 'כימי', 'מולקולה', 'יסודות', 'תרכובת', 'חומרי בנייה', 'chemistry'],
  biology: ['ביולוגיה', 'צמח', 'צמחים', 'צמחי', 'רפואה', 'רפואי', 'בריאות', 'תזונה', 'מזון', 'גנטיקה', 'אקולוגיה', 'ביופיליה', 'ביופילי', 'ביומימטיקה', 'גינה', 'גינות', 'עצים', 'בעלי חיים', 'הרבריום', 'גוף האדם', 'גוף ונפש', 'מוח', 'אבולוציה', 'biology', 'health', 'biophilia'],
  music: ['מוזיקה', 'מוסיקה', 'מנגינה', 'צליל', 'שירה', 'זמר', 'music'],
  dance: ['ריקוד', 'מחול', 'dance', 'כוריאוגרפיה'],
  'combat-sports': ['קרב מגע', 'אגרוף', 'לחימה', 'ספורט', 'כושר', 'martial'],
  painting: ['ציור', 'צייר', 'ציורים', 'אמנות', 'אומנות', 'אמן', 'אמנים', 'תערוכה', 'תערוכות', 'יצירות אמנות', 'איור', 'art', 'painting'],
  sculpture: ['פיסול', 'פסל', 'פסלים', 'sculpture'],
  architecture: ['אדריכלות', 'אדריכל', 'אדריכלי', 'אדריכלים', 'עיצוב פנים', 'בניין', 'בניינים', 'תב"ע', 'תבע', 'בינוי', 'היתר', 'רישוי', 'מגרש', 'התחדשות עירונית', 'תכנון עירוני', 'רחוב', 'שכונה', 'architecture', 'urban'],
  cinema: ['קולנוע', 'סרט', 'סרטים', 'וידאו', 'אנימציה', 'cinema', 'film'],
};

const PREFIX = /^[והבלמשכ]{1,2}(?=[֐-׿]{2,})/;
const norm = (s: string) => s.toLowerCase().replace(/[״"׳']/g, '"').replace(/["]/g, '"');
function words(text: string) {
  return norm(text).split(/[^֐-׿a-z0-9"]+/).filter(Boolean).flatMap((w) => [w, w.replace(PREFIX, '')]);
}

export type Hit = { app: App; dm: string; word: string; field: string };
/** For every app, the archive domains it touches and the word that shows it. */
export function mapApps(apps: App[]) {
  const hits: Hit[] = [];
  for (const app of apps) {
    const fields: [string, string][] = [['שם', `${app.n} ${app.on || ''}`], ['מילות מפתח', (app.k || []).join(' , ')], ['מילים נרדפות', (app.c || []).join(' , ')], ['תיאור', app.t || '']];
    for (const [dm, terms] of Object.entries(LEXICON)) {
      let found: Hit | null = null;
      for (const [field, text] of fields) {
        const ws = new Set(words(text));
        const flat = ' ' + norm(text) + ' ';
        const term = terms.find((t) => (t.includes(' ') ? flat.includes(norm(t)) : ws.has(norm(t))));
        if (term) { found = { app, dm, word: term, field }; break; }
      }
      if (found) hits.push(found);
    }
  }
  return hits;
}

export function analyse(apps: App[]) {
  const hits = mapApps(apps);
  const mapped = new Set(hits.map((h) => h.app.id));
  const totalK = DISCS.length;
  const totalH = hits.length || 1;
  const rows = DOMAINS.map((d) => {
    const hs = hits.filter((h) => h.dm === d.id);
    const k = DISCS.filter((x) => x.dm === d.id).length;
    const kShare = k / totalK, aShare = hs.length / totalH;
    const cells = ACTIONS.map((a) => ({ a: a.id, apps: hs.filter((h) => actionOf(h.app.a) === a.id) }));
    return { d, hits: hs, k, kShare, aShare, gap: kShare - aShare, cells, empty: cells.filter((c) => !c.apps.length && c.a !== 'other').length };
  });
  const holes = rows.filter((r) => !r.hits.length);
  const ranked = rows.slice().sort((a, b) => b.gap - a.gap);
  return { rows, hits, holes, ranked, unmapped: apps.filter((a) => !mapped.has(a.id)), apps };
}

/** The discoveries a new app in a domain can stand on: one per sub-field, latest first, up to three. */
export function anchors(dm: string) {
  const out: Disc[] = [];
  const seen = new Set<string>();
  for (const x of DISCS.filter((d) => d.dm === dm).sort((a, b) => b.y - a.y)) {
    if (seen.has(x.sub)) continue;
    seen.add(x.sub); out.push(x);
    if (out.length === 3) break;
  }
  return out;
}

export const yearLabel = (y: number) => (y < 0 ? `${-y} לפנה״ס` : `${y}`);
export const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

/** Live portfolio from AppOfApp (public read). Falls back to the snapshot. */
const URL = 'https://ktqmwpbzcnzkhjskqisy.supabase.co/rest/v1/aoa_apps?select=id,data';
const KEY = 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q';
export async function loadLive(): Promise<App[] | null> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(URL, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const rows = (await r.json()) as { id: string; data: Record<string, unknown> }[];
    const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? v.split(/[,،]/).map((s) => s.trim()) : null);
    return rows.map(({ id, data }) => ({
      id, n: String(data.name || ''), on: (data.originalName as string) || null, a: (data.action as string) || null,
      d: arr(data.domains), k: arr(data.keywords), c: arr(data.concepts), t: String(data.desc || '').slice(0, 400),
      u: (data.previewUrl as string) || (data.websiteUrl as string) || null,
    }));
  } catch { return null; }
}

export const APP_OF_APP = 'https://appofapp-gh.vercel.app';

/** A ready prompt for Claude Code, in the same shape as the portfolio's gap prompts. */
export function promptFor(d: Domain, action: string, near: App[]) {
  const a = ACTIONS.find((x) => x.id === action)!;
  const base = anchors(d.id);
  return `אני בונה אפליקציה חדשה בתחום ${d.he} (${d.en}), בפעולה "${a.he}".
למה: בתיק העבודות ${near.length ? `יש רק ${near.length} אפליקציות שנוגעות בתחום הזה` : 'אין אף אפליקציה שנוגעת בתחום הזה'}, ובמאגר הגילויים יש בו ${DISCS.filter((x) => x.dm === d.id).length} גילויים מאומתים.
הגילויים שהיא נשענת עליהם (מעולם נעלם ומציאות מצויה, https://olam-gh.vercel.app):
${base.map((x) => `- ${yearLabel(x.y)}, ${x.who.join(' ו') || 'יוצר לא ידוע'}: ${x.t}. מקור: ${x.src.u}`).join('\n')}
${near.length ? `\nאפליקציות קרובות בתיק:\n${near.slice(0, 4).map((x) => `- ${x.n}${x.u ? `: ${x.u}` : ''}`).join('\n')}\n` : ''}
איך נולדת אפליקציה חדשה אצלי:
1. אפיון קצר: למי, מה נכנס, מה יוצא, שלוש התשובות הראשונות שהמשתמש רואה.
2. ריפו חדש בשם <NAME>-GH, Vite + React + TypeScript, עברית ו-RTL.
3. כפתור הלוגו A&I (https://appofapp-gh.vercel.app/ai-menu.js), וכל פעולות העריכה בתוכו.
4. כל עובדה עם מקור, ותקן מדידה לכל כלי מקצועי.
5. בדיקות Playwright, פריסה ל-Vercel, מיזוג ל-main ובדיקת הכתובת החיה.
6. רישום בתיק העבודות ${APP_OF_APP} עם פעולה "${a.he}" ותחום "ידע ורעיונות".
עבוד לפי הסקיל anat-app-builder.`;
}

import type { ActionValue, AppData, Facet } from './types';

/**
 * The action axis: what the user walks away with. Exactly one per app.
 * Rule: an answer about what exists = diagnose; a new product = create;
 * understanding = explore; an orderly process = manage.
 */
export const ACTIONS: { value: ActionValue; label: string; short: string; question: string; synonyms: string[] }[] = [
  { value: 'diagnose', label: 'אבחון ומדידה', short: 'אבחון', question: 'יוצאים עם תשובה על מצב קיים', synonyms: ['אבחון', 'מדידה', 'בדיקה', 'ניתוח', 'מחשבון', 'זיהוי', 'דשבורד', 'כלי', 'כלי מדידה', 'הערכה', 'מדד'] },
  { value: 'create', label: 'יצירה', short: 'יצירה', question: 'יוצאים עם תוצר חדש', synonyms: ['יצירה', 'יצירת', 'עיצוב', 'הדמיה', 'מחולל', 'כלי', 'תכנון', 'סטודיו'] },
  { value: 'explore', label: 'חקירה ולמידה', short: 'חקירה', question: 'יוצאים עם הבנה', synonyms: ['חקירה', 'מחקר', 'למידה', 'עניין', 'מידע', 'מפה', 'גילוי'] },
  { value: 'manage', label: 'ניהול ומעקב', short: 'ניהול', question: 'יוצאים עם תהליך מסודר', synonyms: ['ניהול', 'מעקב', 'בקשה', 'תהליך', 'טבלה', 'משימות', 'הגשה', 'דיווח'] },
  { value: 'inspire', label: 'השראה', short: 'השראה', question: 'יוצאים עם רעיון', synonyms: ['השראה', 'רעיון', 'רעיונות', 'מוזה', 'אוסף'] },
  { value: 'teach', label: 'הוראה והצגה', short: 'הוראה', question: 'מעבירים ידע לאחרים', synonyms: ['הוראה', 'קורס', 'מצגת', 'הרצאה', 'הכשרה', 'הנחיות', 'תיק עבודות', 'גלריה'] },
  { value: 'play', label: 'משחק ואימון', short: 'משחק', question: 'מתרגלים ומשחקים', synonyms: ['משחק', 'אימון', 'מבחן', 'תרגול', 'תרגיל', 'חידון'] },
];

export const actionOf = (v?: string) => ACTIONS.find((a) => a.value === v);

export const facetLabel = (facets: Facet[], kind: Facet['kind'], v: string) =>
  facets.find((f) => f.kind === kind && f.value === v)?.label ?? v;

const norm = (s: string) => s.toLowerCase().replace(/["'״׳]/g, '').trim();

/** Which vocabulary entries the query names, through labels or synonyms. */
export function matchVocabulary(q: string, facets: Facet[]) {
  const t = norm(q);
  if (t.length < 2) return { actions: [] as ActionValue[], domains: [] as string[], contexts: [] as string[] };
  const hits = (words: string[]) => words.some((w) => {
    const n = norm(w);
    return n === t || (t.length >= 3 && (n.startsWith(t) || t.startsWith(n) && n.length >= 3));
  });
  return {
    actions: ACTIONS.filter((a) => hits([a.label, a.short, ...a.synonyms])).map((a) => a.value),
    domains: facets.filter((f) => f.kind === 'domain' && hits([f.label, ...f.synonyms])).map((f) => f.value),
    contexts: facets.filter((f) => f.kind === 'context' && hits([f.label, ...f.synonyms])).map((f) => f.value),
  };
}

/** All the words an app can be found by, beyond its own text. */
export function facetText(app: AppData, facets: Facet[]) {
  const a = actionOf(app.action);
  const parts: string[] = [];
  if (a) parts.push(a.label, ...a.synonyms);
  for (const kind of ['domain', 'context'] as const) {
    const vals = kind === 'domain' ? app.domains : app.contexts;
    for (const v of vals ?? []) {
      const f = facets.find((x) => x.kind === kind && x.value === v);
      if (f) parts.push(f.label, ...f.synonyms);
    }
  }
  return parts.join(' ');
}

/** Related apps: shared domains weigh most, then action, context and keywords. */
export function related(app: AppData, apps: AppData[], n = 4) {
  const score = (b: AppData) => {
    let s = 0;
    for (const d of app.domains ?? []) if (b.domains?.includes(d)) s += 3;
    if (app.action && b.action === app.action) s += 2;
    for (const c of app.contexts ?? []) if (b.contexts?.includes(c)) s += 1;
    for (const k of app.keywords ?? []) if (b.keywords?.includes(k)) s += 2;
    return s;
  };
  return apps
    .filter((b) => b.id !== app.id)
    .map((b) => ({ b, s: score(b) }))
    .filter((x) => x.s >= 3)
    .sort((x, y) => y.s - x.s)
    .slice(0, n)
    .map((x) => x.b);
}

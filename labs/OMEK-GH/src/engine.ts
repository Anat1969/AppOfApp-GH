import OLAM from './data/olam.json';

export type Domain = { id: string; he: string; en: string; family: string; familyHe: string; color: string; subs: { id: string; he: string }[] };
export type Disc = {
  id: string; t: string; y: number; y2: number | null; ya: boolean; dm: string; sub: string;
  who: { he: string; en: string }[]; city: { he: string; en: string } | null;
  nov: string; con: string; q: string; qo: string; src: { t: string; u: string }; conf: string;
};
export const DOMAINS = OLAM.domains as Domain[];
export const DISCS = OLAM.discoveries as Disc[];
export const domainOf = (id: string) => DOMAINS.find((d) => d.id === id)!;

export type QType = 'who' | 'when' | 'where';
export type Question = { id: string; disc: Disc; type: QType; prompt: string; options: string[]; answer: number };

/** Certainty-based marking (Gardner-Medwin, UCL LAPT): three levels of confidence, each with its own reward and penalty. */
export type Conf = 1 | 2 | 3;
export const CONF: Record<Conf, { he: string; hint: string; p: number; right: number; wrong: number }> = {
  1: { he: 'מנחש', hint: 'פחות מ-67%', p: 0.25, right: 1, wrong: 0 },
  2: { he: 'חושב', hint: '67% עד 80%', p: 0.73, right: 2, wrong: -2 },
  3: { he: 'בטוח', hint: 'מעל 80%', p: 0.9, right: 3, wrong: -6 },
};

export type Answer = { q: string; disc: string; dm: string; type: QType; correct: boolean; conf: Conf; ts: number };

/** The four depths of knowing. The colour of each is fixed across the app. */
export type State = 'know' | 'partly' | 'illusion' | 'unknown';
export const STATE: Record<State, { he: string; short: string; why: string }> = {
  know: { he: 'יודע', short: 'עמוק', why: 'ענית נכון, ובביטחון.' },
  partly: { he: 'יודע בערך', short: 'בינוני', why: 'ענית נכון, אבל בלי ביטחון מלא.' },
  illusion: { he: 'חושב שיודע', short: 'שרטון', why: 'ענית בביטחון, וטעית. זה המקום המסוכן.' },
  unknown: { he: 'לא יודע', short: 'מים פתוחים', why: 'ניחשת. ניחוש מוצלח לא נחשב ידיעה.' },
};
export const stateOf = (a: Pick<Answer, 'correct' | 'conf'>): State =>
  a.conf === 1 ? 'unknown' : a.correct ? (a.conf === 3 ? 'know' : 'partly') : 'illusion';

/* ---------- deterministic random ---------- */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const shuffle = <T,>(a: T[], r: () => number) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export const century = (y: number) => (y < 0 ? `המאה ה-${Math.ceil(-y / 100)} לפנה״ס` : `המאה ה-${Math.floor((y - 1) / 100) + 1}`);
const centuryNum = (y: number) => (y < 0 ? -Math.ceil(-y / 100) : Math.floor((y - 1) / 100) + 1);
const centuryLabel = (c: number) => (c < 0 ? `המאה ה-${-c} לפנה״ס` : `המאה ה-${c}`);
export const yearLabel = (y: number) => (y < 0 ? `${-y} לפנה״ס` : `${y}`);

function distinct(pool: string[], correct: string, n: number, r: () => number) {
  const out: string[] = [];
  for (const p of shuffle(pool, r)) { if (p && p !== correct && !out.includes(p)) out.push(p); if (out.length === n) break; }
  return out;
}

/** Builds one question from a verified discovery. Distractors come from the same domain, so the question tests knowledge, not elimination. */
export function makeQuestion(d: Disc, type: QType, r: () => number): Question | null {
  const same = DISCS.filter((x) => x.dm === d.dm && x.id !== d.id);
  let correct = '', pool: string[] = [], prompt = '';
  if (type === 'who') {
    if (!d.who.length) return null;
    correct = d.who.map((w) => w.he).join(' ו');
    pool = same.flatMap((x) => (x.who[0] ? [x.who[0].he] : [])).filter((n) => !d.who.some((w) => w.he === n));
    prompt = 'מי עומד מאחורי הגילוי?';
  } else if (type === 'when') {
    const c = centuryNum(d.y);
    correct = centuryLabel(c);
    const near = [c - 3, c - 2, c - 1, c + 1, c + 2, c + 3].filter((x) => x !== 0 && x <= 21);
    pool = [...new Set([...same.map((x) => centuryLabel(centuryNum(x.y))), ...near.map(centuryLabel)])];
    prompt = 'מתי זה קרה?';
  } else {
    if (!d.city) return null;
    correct = d.city.he;
    pool = DISCS.filter((x) => x.city && x.city.he !== d.city!.he).map((x) => x.city!.he);
    prompt = 'איפה זה קרה?';
  }
  const wrong = distinct(pool, correct, 3, r);
  if (wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong], r);
  return { id: `${d.id}:${type}`, disc: d, type, prompt, options, answer: options.indexOf(correct) };
}

/** A round: one question per domain (or N from one domain), from discoveries not asked before. */
export function makeRound(seed: number, asked: Set<string>, only?: string, n = 10): Question[] {
  const r = rng(seed);
  const types: QType[] = ['who', 'when', 'where'];
  const pick = (dm: string, count: number) => {
    const out: Question[] = [];
    const cands = shuffle(DISCS.filter((x) => x.dm === dm), r);
    const fresh = [...cands.filter((x) => !types.every((t) => asked.has(`${x.id}:${t}`))), ...cands];
    for (const d of fresh) {
      for (const t of shuffle(types, r)) {
        if (asked.has(`${d.id}:${t}`) && fresh.length > count) continue;
        const q = makeQuestion(d, t, r);
        if (q && !out.some((o) => o.disc.id === d.id)) { out.push(q); break; }
      }
      if (out.length === count) break;
    }
    return out;
  };
  if (only) return pick(only, n);
  return shuffle(DOMAINS.flatMap((d) => pick(d.id, 1)), r);
}

/* ---------- measurement ---------- */
/** Wilson score interval, 95%. Honest about how little a few answers say. */
export function wilson(k: number, n: number) {
  if (!n) return [0, 1] as const;
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)] as const;
}

export function measure(ans: Answer[]) {
  const n = ans.length;
  const k = ans.filter((a) => a.correct).length;
  const cbm = ans.reduce((s, a) => s + (a.correct ? CONF[a.conf].right : CONF[a.conf].wrong), 0);
  const brier = n ? ans.reduce((s, a) => s + (CONF[a.conf].p - (a.correct ? 1 : 0)) ** 2, 0) / n : 0;
  const meanConf = n ? ans.reduce((s, a) => s + CONF[a.conf].p, 0) / n : 0;
  const over = n ? meanConf - k / n : 0; // positive: more sure than right
  const byConf = ([1, 2, 3] as Conf[]).map((c) => { const g = ans.filter((a) => a.conf === c); return { c, n: g.length, k: g.filter((a) => a.correct).length }; });
  const states: Record<State, number> = { know: 0, partly: 0, illusion: 0, unknown: 0 };
  ans.forEach((a) => states[stateOf(a)]++);
  const byDomain = DOMAINS.map((d) => {
    const g = ans.filter((a) => a.dm === d.id);
    const s: Record<State, number> = { know: 0, partly: 0, illusion: 0, unknown: 0 };
    g.forEach((a) => s[stateOf(a)]++);
    // depth 0..1: what share of answers in the domain is real knowledge (full or partial)
    const depth = g.length ? (s.know + s.partly * 0.6) / g.length : null;
    return { d, n: g.length, s, depth, illusion: g.length ? s.illusion / g.length : 0 };
  });
  return { n, k, cbm, maxCbm: n * 3, brier, meanConf, over, byConf, states, byDomain, ci: wilson(k, n) };
}

/** The one sentence the result screen leads with. Computed, never written by a model. */
export function insight(m: ReturnType<typeof measure>): string {
  if (!m.n) return 'עוד לא נמדד. **עשר שאלות** מספיקות למפה ראשונה.';
  const shoals = m.byDomain.filter((x) => x.s.illusion > 0).sort((a, b) => b.illusion - a.illusion);
  const deep = m.byDomain.filter((x) => x.n && x.depth! >= 0.75).sort((a, b) => b.depth! - a.depth!);
  if (m.over > 0.15 && shoals.length) return `==הביטחון שלך גבוה מהידיעה== ב-**${Math.round(m.over * 100)}** נקודות. השרטון העיקרי: **${shoals[0].d.he}**.`;
  if (m.over < -0.15) return `==אתה יודע יותר ממה שאתה חושב.== צדקת ב-**${Math.round((m.k / m.n) * 100)}%**, אבל סימנת ביטחון נמוך.`;
  if (shoals.length) return `הכיול שלך טוב, ויש **${shoals.length}** שרטונות. ==${shoals[0].d.he}== הוא הראשון לבדוק.`;
  if (deep.length) return `==הכיול שלך מדויק.== העומק הגדול ביותר: **${deep[0].d.he}**.`;
  return `==הכיול שלך מדויק:== מה שסימנת כניחוש, היה ניחוש.`;
}

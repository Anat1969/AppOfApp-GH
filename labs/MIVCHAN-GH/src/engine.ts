import A from './data/archive.json';
import { TESTS, type Test, type Verdict } from './data/tests';

export type Disc = {
  id: string; t: string; y: number; y2: number | null; ya: boolean; dm: string; sub: string;
  who: { he: string; en: string }[]; city: { he: string; en: string } | null;
  nov: string; con: string; q: string; qo: string; src: { t: string; u: string }; conf: string;
};
export type Saying = { id: string; idea: string; side: 'a' | 'b' | 's'; he: string; orig?: string; culture: string; src: string; year: number | null };
export type Idea = { id: string; chip: string; q: string; a: string; b: string };

export const DISC = new Map((A.discoveries as Disc[]).map((d) => [d.id, d]));
export const SAY = new Map((A.sayings as Saying[]).map((s) => [s.id, s]));
export const IDEAS = A.ideas as Idea[];
export const DOMAIN = new Map(A.domains.map((d) => [d.id, d]));

export type Row = Test & { s: Saying; c?: Saying; d: Disc[]; ideaQ: string; wait: number | null };
export const ROWS: Row[] = TESTS.map((t) => {
  const s = SAY.get(t.saying);
  if (!s) throw new Error(`missing saying ${t.saying}`);
  const d = t.discs.map((id) => { const x = DISC.get(id); if (!x) throw new Error(`missing discovery ${id}`); return x; });
  const first = Math.min(...d.map((x) => x.y));
  return { ...t, s, c: t.counter ? SAY.get(t.counter) : undefined, d, ideaQ: IDEAS.find((i) => i.id === t.idea)?.q || '', wait: s.year === null ? null : first - s.year };
});

/** Ideas in the sayings atlas that no verified discovery answers yet: holes, shown as holes. */
export const UNTESTED = IDEAS.filter((i) => !TESTS.some((t) => t.idea === i.id));

export const count = (v: Verdict) => ROWS.filter((r) => r.verdict === v).length;
export const yearLabel = (y: number) => (y < 0 ? `${-y} לפנה״ס` : `${y}`);

export const longest = () => ROWS.filter((r) => r.wait !== null).sort((a, b) => b.wait! - a.wait!)[0];
export const OLAM = 'https://olam-gh.vercel.app';
export const AMIROT = 'https://amirot-gh.vercel.app';
export const olamLink = (d: Disc) => `${OLAM}/#/search?q=${encodeURIComponent(d.t.split(':')[0])}`;
export const amirotLink = (s: Saying) => `${AMIROT}/#/daf?i=${s.idea}&s=${s.id}`;

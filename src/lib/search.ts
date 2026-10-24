import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { AppData, Facet } from './types';
import { facetText, matchVocabulary } from './facets';

const KEYS = ['name', 'originalName', 'keywords', 'concepts', 'title', 'facets', 'text'];

/** Hebrew attaches ה, ו, ב, ל, מ, ש, כ to the word: "והמשכורת" is "משכורת". */
export function variants(word: string): string[] {
  const out = new Set([word]);
  let w = word;
  for (let i = 0; i < 2 && w.length > 3 && /^[הובלמשכ]/.test(w); i++) {
    w = w.slice(1);
    out.add(w);
  }
  return [...out];
}

const norm = (s: string) => s.toLowerCase().replace(/["'״׳]/g, '');

/** The first keyword or concept that explains why the app matched. */
function reasonFor(app: AppData, words: string[]): string | undefined {
  const name = norm(`${app.name} ${app.originalName ?? ''}`);
  for (const w of words) {
    if (vs(w).some((v) => name.includes(norm(v)))) return undefined; // found by name, no need to explain
  }
  const pool = [...(app.keywords ?? []), ...(app.concepts ?? [])];
  for (const w of words) {
    for (const v of vs(w)) {
      const n = norm(v);
      const hit = pool.find((p) => {
        const q = norm(p);
        return q.includes(n) || (n.length >= 3 && n.includes(q) && q.length >= 3);
      });
      if (hit) return hit;
    }
  }
  return undefined;
}
const vs = (w: string) => variants(w);

export interface SearchResult {
  items: AppData[];
  vocab: ReturnType<typeof matchVocabulary>;
  reasons: Map<string, string>;
  /** True when nothing matched exactly and these are the closest guesses. */
  near: boolean;
}

/**
 * Search by name (also the old name), keywords, hidden concepts (everyday words, synonyms,
 * English), text and the vocabulary: typing "משכורת" finds "תלושי שכר", "כלי" finds every
 * diagnose and create app. Every word typed must match, so each word narrows the results.
 */
export function useSearch(apps: AppData[], facets: Facet[]) {
  const { fuse, loose } = useMemo(() => {
    const docs = apps.map((a) => ({
      app: a,
      name: a.name,
      originalName: a.originalName ?? '',
      title: a.title ?? '',
      keywords: (a.keywords ?? []).join(' '),
      concepts: (a.concepts ?? []).join(' '),
      text: [a.desc, a.problem, a.solution, a.purpose].filter(Boolean).join(' '),
      facets: facetText(a, facets),
    }));
    const keys = [
      { name: 'name', weight: 3 },
      { name: 'originalName', weight: 2 },
      { name: 'keywords', weight: 2 },
      { name: 'concepts', weight: 1.5 },
      { name: 'title', weight: 1 },
      { name: 'facets', weight: 1 },
      { name: 'text', weight: 0.6 },
    ];
    return {
      fuse: new Fuse(docs, { keys, threshold: 0.33, ignoreLocation: true, minMatchCharLength: 2 }),
      loose: new Fuse(docs, { keys, threshold: 0.5, ignoreLocation: true, minMatchCharLength: 2 }),
    };
  }, [apps, facets]);

  return useMemo(
    () =>
      (q: string): SearchResult => {
        const t = q.trim();
        const empty = { items: apps, vocab: matchVocabulary('', facets), reasons: new Map<string, string>(), near: false };
        if (t.length < 2) return empty;
        const words = t.split(/\s+/).filter((w) => w.length >= 2);
        if (!words.length) return empty;

        const vocab = words.length === 1 ? matchVocabulary(words[0], facets) : matchVocabulary(t, facets);
        const byVocab = apps.filter(
          (a) =>
            (a.action && vocab.actions.includes(a.action)) ||
            a.domains?.some((d) => vocab.domains.includes(d)) ||
            a.contexts?.some((c) => vocab.contexts.includes(c)),
        );
        const wordQuery = (w: string) => ({ $or: variants(w).flatMap((v) => KEYS.map((k) => ({ [k]: v }))) });
        const query = words.length > 1 ? { $and: words.map(wordQuery) } : wordQuery(words[0]);
        const fuzzy = fuse.search(query).map((r) => r.item.app);
        const seen = new Set(fuzzy.map((a) => a.id));
        let items = [...fuzzy, ...byVocab.filter((a) => !seen.has(a.id))];
        let near = false;
        if (!items.length) {
          items = loose.search({ $or: words.flatMap((w) => variants(w).flatMap((v) => KEYS.map((k) => ({ [k]: v })))) }).slice(0, 8).map((r) => r.item.app);
          near = items.length > 0;
        }
        const reasons = new Map<string, string>();
        for (const a of items) {
          const r = reasonFor(a, words);
          if (r) reasons.set(a.id, r);
        }
        return { items, vocab, reasons, near };
      },
    [apps, facets, fuse, loose],
  );
}

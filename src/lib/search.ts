import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { AppData, Facet } from './types';
import { facetText, matchVocabulary } from './facets';

/**
 * Search by name (also the old name), text, keywords, and the vocabulary:
 * typing "כלי" finds every diagnose and create app, "תב\"ע" every urban planning app.
 */
export function useSearch(apps: AppData[], facets: Facet[]) {
  const fuse = useMemo(() => {
    const docs = apps.map((a) => ({
      app: a,
      name: a.name,
      originalName: a.originalName ?? '',
      title: a.title ?? '',
      keywords: (a.keywords ?? []).join(' '),
      text: [a.desc, a.problem, a.solution, a.purpose].filter(Boolean).join(' '),
      facets: facetText(a, facets),
    }));
    return new Fuse(docs, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'originalName', weight: 2 },
        { name: 'keywords', weight: 2 },
        { name: 'title', weight: 1 },
        { name: 'facets', weight: 1 },
        { name: 'text', weight: 0.6 },
      ],
      threshold: 0.33,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [apps, facets]);

  return useMemo(
    () => (q: string) => {
      const t = q.trim();
      if (t.length < 2) return { items: apps, vocab: matchVocabulary('', facets) };
      const vocab = matchVocabulary(t, facets);
      const byVocab = apps.filter(
        (a) =>
          (a.action && vocab.actions.includes(a.action)) ||
          a.domains?.some((d) => vocab.domains.includes(d)) ||
          a.contexts?.some((c) => vocab.contexts.includes(c)),
      );
      const fuzzy = fuse.search(t).map((r) => r.item.app);
      const seen = new Set(fuzzy.map((a) => a.id));
      return { items: [...fuzzy, ...byVocab.filter((a) => !seen.has(a.id))], vocab };
    },
    [apps, facets, fuse],
  );
}

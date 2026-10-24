import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import type { SearchResult } from '../lib/search';
import type { Route } from '../lib/route';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';
import { thumbOf } from '../lib/format';

interface Props {
  route: Route;
  apps: AppData[];
  facets: Facet[];
  search: (q: string) => SearchResult;
  onHome: () => void;
  onSearch: (q: string) => void;
  onOpen: (id: string) => void;
  onView: (v: Route['view']) => void;
  go: (p: Partial<Route>) => void;
  menu: ReactNode;
}

/** Marks the typed text inside a name. */
function highlight(name: string, q: string) {
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return name;
  return (
    <>
      {name.slice(0, i)}
      <mark>{name.slice(i, i + q.length)}</mark>
      {name.slice(i + q.length)}
    </>
  );
}

export default function TopBar({ route, apps, facets, search, onHome, onSearch, onOpen, onView, go, menu }: Props) {
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = route.q.trim();

  const live = useMemo(() => (q.length >= 2 ? search(q) : null), [q, search]);
  const suggestions = live?.items ?? [];
  const expanded = live
    ? [
        ...live.vocab.actions.map((v) => actionOf(v)?.label),
        ...live.vocab.domains.map((v) => facetLabel(facets, 'domain', v)),
        ...live.vocab.contexts.map((v) => facetLabel(facets, 'context', v)),
      ].filter(Boolean)
    : [];
  const topKeywords = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of apps) for (const k of a.keywords ?? []) count.set(k, (count.get(k) ?? 0) + 1);
    return [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
  }, [apps]);

  const pick = (p: Partial<Route>) => {
    go({ app: null, view: 'home', q: '', action: null, domain: null, ctx: null, ...p });
    input.current?.blur();
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          aria-label="דף הבית"
        >
          <img src={import.meta.env.BASE_URL + 'icon.svg'} alt="" className="brand-mark" />
          <span className="brand-name">Apps</span>
          <span className="brand-sub">תיק עבודות</span>
        </a>

        <div className="search">
          <input
            ref={input}
            type="search"
            value={route.q}
            placeholder="חיפוש לפי שם, פעולה, תחום או מילת מפתח"
            aria-label="חיפוש"
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearch('');
                input.current?.blur();
              }
            }}
          />
          <AnimatePresence>
            {focus && (

              <motion.div className="suggest" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} onMouseDown={(e) => e.preventDefault()}>
                {q.length < 2 ? (
                  <div className="search-help">
                    <p className="help-lead">
                      אפשר לחפש ב<b>שם</b> (גם בשם הישן), ב<b>מילת מפתח</b> או בתוכן. כל אפליקציה מסווגת גם בשלושה צירים, ומילים נרדפות מרחיבות את החיפוש: <b>"כלי"</b> מוצא אבחון ויצירה, <b>"תב"ע"</b> מוצא תכנון עירוני.
                    </p>
                    <div className="help-row">
                      <span className="mono">פעולה · מה יוצאים איתו</span>
                      <div>
                        {ACTIONS.map((a) => (
                          <button key={a.value} className="tag" onClick={() => pick({ action: a.value })} title={a.question}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="help-row">
                      <span className="mono">תחום · על מה</span>
                      <div>
                        {facets.filter((f) => f.kind === 'domain').map((f) => (
                          <button key={f.value} className="tag" onClick={() => pick({ domain: f.value })}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="help-row">
                      <span className="mono">הקשר · בשביל מי</span>
                      <div>
                        {facets.filter((f) => f.kind === 'context').map((f) => (
                          <button key={f.value} className="tag" onClick={() => pick({ ctx: f.value })}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {topKeywords.length > 0 && (
                      <div className="help-row">
                        <span className="mono">מילות מפתח נפוצות</span>
                        <div>
                          {topKeywords.map((k) => (
                            <button key={k} className="tag kw" onClick={() => pick({ q: k })}>
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="live">
                    <div className="live-head">
                      <span className="mono">
                        {!suggestions.length ? 'אין התאמה' : live?.near ? 'לא נמצאה התאמה מדויקת. אולי התכוונת:' : `${suggestions.length} אפליקציות`}
                      </span>
                      {expanded.length > 0 && <span className="dim">כולל: {expanded.join(', ')}</span>}
                    </div>
                    {suggestions.length === 0 ? (
                      <p className="dim live-empty">נסי מילה אחרת, או תחום כמו "תכנון עירוני".</p>
                    ) : (
                      <motion.ul className="live-grid" layout>
                        <AnimatePresence initial={false}>
                          {suggestions.slice(0, 12).map((a) => {
                            const t = thumbOf(a);
                            return (
                              <motion.li
                                key={a.id}
                                layout
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
                              >
                                <button
                                  className="live-card"
                                  onClick={() => {
                                    onOpen(a.id);
                                    input.current?.blur();
                                  }}
                                  title={a.name}
                                >
                                  <span className="live-thumb">
                                    {t ? <img src={t} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : <span className="live-initial">{a.name.slice(0, 1)}</span>}
                                  </span>
                                  <span className="live-name">{highlight(a.name, q)}</span>
                                  <span className="mono dim">{actionOf(a.action)?.short ?? ''}</span>
                                  {live?.reasons.get(a.id) && <span className="live-why">דרך: {live.reasons.get(a.id)}</span>}
                                </button>
                              </motion.li>
                            );
                          })}
                        </AnimatePresence>
                      </motion.ul>
                    )}
                    {suggestions.length > 12 && (
                      <button className="link live-all" onClick={() => input.current?.blur()}>
                        הצגת כל {suggestions.length} התוצאות בעמוד
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="actions" aria-label="תצוגה">
          <button className={`tab ${route.view === 'home' ? 'on' : ''}`} onClick={() => onView('home')}>
            מפה
          </button>
          <button className={`tab ${route.view === 'table' ? 'on' : ''}`} onClick={() => onView('table')}>
            טבלה
          </button>
          <span className="sep" aria-hidden />
          {menu}
        </nav>
      </div>
    </header>
  );
}

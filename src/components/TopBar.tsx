import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { ACTIONS, actionOf } from '../lib/facets';

interface Props {
  route: Route;
  apps: AppData[];
  facets: Facet[];
  search: (q: string) => { items: AppData[] };
  onHome: () => void;
  onSearch: (q: string) => void;
  onOpen: (id: string) => void;
  onView: (v: Route['view']) => void;
  go: (p: Partial<Route>) => void;
  menu: ReactNode;
}

export default function TopBar({ route, apps, facets, search, onHome, onSearch, onOpen, onView, go, menu }: Props) {
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = route.q.trim();

  const suggestions = useMemo(() => (q.length >= 2 ? search(q).items.slice(0, 7) : []), [q, search]);
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
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          aria-label="דף הבית"
        >
          <img src="/icon.svg" alt="" className="brand-mark" />
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
            {focus && (q.length < 2 || suggestions.length > 0) && (
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
                  <ul>
                    {suggestions.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => {
                            onOpen(a.id);
                            input.current?.blur();
                          }}
                        >
                          <span>{a.name}</span>
                          <span className="mono dim">{actionOf(a.action)?.short ?? ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
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

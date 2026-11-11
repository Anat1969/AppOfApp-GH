import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ActionValue, AppData, Facet } from '../lib/types';
import { hasFilters, type Route } from '../lib/route';
import { createdOf, time } from '../lib/format';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';
import AppCard from './AppCard';
import Filters from './Filters';
import Matrix, { type AddPrefill } from './Matrix';
import Vocabulary from './Vocabulary';
import BeyondMap from './BeyondMap';
import CellPage from './CellPage';

interface Props {
  apps: AppData[];
  results: AppData[];
  searched: AppData[];
  facets: Facet[];
  sheets: Map<string, string>;
  route: Route;
  go: (p: Partial<Route>) => void;
  sort: 'date' | 'alpha';
  setSort: (s: 'date' | 'alpha') => void;
  vocab: { actions: ActionValue[]; domains: string[]; contexts: string[] };
  reasons: Map<string, string>;
  near: boolean;
  onAdd: (p?: AddPrefill) => void;
  saveFacet: (f: Facet) => Promise<boolean>;
  deleteFacet: (f: Facet) => Promise<boolean>;
}

export default function Home({ apps, results, searched, facets, sheets, route, go, sort, setSort, vocab, reasons, near, onAdd, saveFacet, deleteFacet }: Props) {
  const filtering = hasFilters(route);
  const domainsOf = (a: AppData) => (a.domains ?? []).map((d) => facetLabel(facets, 'domain', d)).join(' · ');

  // Added and updated are two lists (Anat, 2026-11-04): an app counts as updated only when it changed after the day it was added.
  const MONTH = 30 * 86_400_000;
  const added = useMemo(() => apps.filter((a) => Date.now() - createdOf(a) < MONTH).sort((a, b) => createdOf(b) - createdOf(a)).slice(0, 6), [apps]);
  // Each app appears once in this band (Anat, 2026-11-09: the same app sat in both lists): an app already shown as
  // added is not repeated as updated.
  const updated = useMemo(() => {
    const shown = new Set(added.map((a) => a.id));
    return apps
      .filter((a) => {
        if (shown.has(a.id)) return false;
        const u = time(a.updatedAt);
        return Date.now() - u < MONTH && u - createdOf(a) > 86_400_000;
      })
      .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
      .slice(0, 6);
  }, [apps, added]);

  const q = route.q.trim();
  const expanded = [
    ...vocab.actions.map((v) => actionOf(v)?.label),
    ...vocab.domains.map((v) => facetLabel(facets, 'domain', v)),
    ...vocab.contexts.map((v) => facetLabel(facets, 'context', v)),
  ].filter(Boolean);

  const summary = [
    route.action && actionOf(route.action)?.label,
    route.domain && facetLabel(facets, 'domain', route.domain),
    route.ctx && facetLabel(facets, 'context', route.ctx),
    q && `"${q}"`,
    route.links && 'עם אתר',
  ].filter(Boolean);

  // The sections sit in one bar that stays in place; only the content under it changes (Anat, 2026-11-04). A search or a
  // filter always shows the sheets.
  const sec = filtering ? 'all' : route.sec;
  const cell = sec === 'map' ? route.cell : null;
  const bar = useRef<HTMLElement>(null);
  const [vocabOpen, setVocabOpen] = useState(false);
  const pick = (s: Route['sec']) => {
    go({ sec: s, cell: null });
    const el = bar.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h') || '64');
      if (window.scrollY > top) scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    }
  };
  const SECTIONS: { key: Route['sec']; no: string; label: string; n?: number }[] = [
    { key: 'new', no: '01', label: 'חדש בתיק', n: added.length + updated.length },
    { key: 'map', no: '02', label: 'מפת התחומים והפעולות' },
    { key: 'all', no: '03', label: 'כל הגיליונות', n: apps.length },
    { key: 'beyond', no: '04', label: 'סינתזות ושורות חדשות' },
  ];

  return (
    <div className="home">
      <nav className="sec-bar" ref={bar} aria-label="חלקי דף הבית">
        {SECTIONS.map((x) => (
          <button key={x.key} className={sec === x.key ? 'on' : ''} aria-pressed={sec === x.key} onClick={() => pick(x.key)}>
            <span className="mono">{x.no}</span>
            {x.label}
            {x.n !== undefined && <span className="mono dim">{x.n}</span>}
          </button>
        ))}
        <button className={`solid sec-add ${sec === 'new' ? 'is-hidden' : ''}`} onClick={() => onAdd({ action: route.action ?? undefined, domain: route.domain ?? undefined })}>
          הוספת אפליקציה חדשה
        </button>
      </nav>

      <AnimatePresence mode="wait">
      <motion.div key={cell ? `cell:${cell}` : sec} className="sec-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

      {sec === 'new' && (
        <section className="hero hero-welcome">
          <div className="hero-text">
            <div className="mono kicker">
              תיק אפליקציות · {apps.length} אפליקציות · {ACTIONS.length} פעולות · {facets.filter((f) => f.kind === 'domain').length} תחומים
            </div>
            <h1>
              בחר: תחום, נושא
              <br />
              או אפליקציה
            </h1>
            <p className="lead">כל גיליון פותח עולם שלם: בעיה, פתרון, ותוצר שעובד בפועל.</p>
            <p className="hero-invite">הסרטון מראה ב-20 שניות את החזון: דפי הבית של כל הכלים, מפה אחת שמסדרת אותם, ומקרה אחד.</p>
            <div className="hero-cta">
              <button className="solid hero-add" onClick={() => onAdd()}>
                הוספת אפליקציה חדשה
              </button>
              <button className="ghost hero-map" onClick={() => pick('map')}>
                למפת התחומים
              </button>
            </div>
          </div>
          {/* The demo video has the place of honour (Anat, 2026-11-05: "דף הבית לא מזמין. צריך להיות כבוד לסרטון"):
              public/demo.js fills this slot with a full-width poster and a big play mark. */}
          <div className="hero-demo" data-aoa-demo="hero" />
        </section>
      )}
      {sec === 'new' && (
        <section className="band sec-section">
          <header className="band-head">
            <span className="mono">01</span>
            <h2>חדש בתיק</h2>
            <span className="band-note">שלושים הימים האחרונים</span>
          </header>
          <div className="recent-rows">
            <div className="recent-col">
              <h3>
                נוספו לאחרונה <span className="mono dim">{added.length}</span>
              </h3>
              {added.length ? (
                <div className="recent">
                  {added.map((a, i) => (
                    <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={domainsOf(a)} onOpen={() => go({ app: a.id })} index={i} compact />
                  ))}
                </div>
              ) : (
                <p className="dim">לא נוספו אפליקציות בחודש האחרון.</p>
              )}
            </div>
            <div className="recent-col">
              <h3>
                עודכנו לאחרונה <span className="mono dim">{updated.length}</span>
              </h3>
              {updated.length ? (
                <div className="recent">
                  {updated.map((a, i) => (
                    <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={domainsOf(a)} onOpen={() => go({ app: a.id })} index={i} compact />
                  ))}
                </div>
              ) : (
                <p className="dim">אין עדכונים לאפליקציות ותיקות בחודש האחרון.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {cell && <CellPage cell={cell} apps={apps} facets={facets} sheets={sheets} go={go} onAdd={onAdd} />}

      {sec === 'map' && !cell && (
        <section className="band sec-section band-map">
          <header className="band-head">
            <span className="mono">02</span>
            <h2>מפת התחומים והפעולות</h2>
            <span className="band-note">שורה היא תחום, עמודה היא מה יוצאים איתו. ריחוף על משבצת מציג את האפליקציות בה, ולחיצה פותחת אותן בדף משלהן, עם חזרה למפה. משבצת ריקה היא פער, ובה הצעה לאפליקציה חדשה.</span>
          </header>
          <Matrix apps={apps} facets={facets} sheets={sheets} go={go} onAdd={onAdd} />
          <button className="link inline-edit vocab-toggle" onClick={() => setVocabOpen((v) => !v)}>
            {vocabOpen ? 'סגירת המילון' : 'עריכת מילון התחומים וההקשרים'}
          </button>
          {vocabOpen && <Vocabulary facets={facets} saveFacet={saveFacet} deleteFacet={deleteFacet} />}
        </section>
      )}

      {/* Syntheses and new rows have their own section, 04 (Anat, 2026-11-09), so the map section ends with the map. */}
      {sec === 'beyond' && (
        <section className="band sec-section band-beyond">
          <header className="band-head">
            <span className="mono">04</span>
            <h2>סינתזות ושורות חדשות</h2>
            <span className="band-note">רעיונות שמעבר למפה: מיזוגים בין תחומים רחוקים, ושורות ועמודות שעוד אין בה.</span>
          </header>
          <BeyondMap apps={apps} facets={facets} go={go} onAdd={onAdd} saveFacet={saveFacet} />
        </section>
      )}

      {sec === 'all' && (
      <section className="band sec-section" id="catalog">
        <header className="band-head">
          <span className="mono">{filtering ? 'Q' : '03'}</span>
          <h2>{filtering ? `${results.length} אפליקציות` : 'כל הגיליונות'}</h2>
          {filtering && <span className="band-note">{summary.join(' · ')}</span>}
          <div className="filters">
            <button className="solid" onClick={() => onAdd({ action: route.action ?? undefined, domain: route.domain ?? undefined })}>
              הוספת אפליקציה
            </button>
            {filtering && (
              <button className="chip on" onClick={() => go({ q: '', action: null, domain: null, ctx: null, links: false, sec: 'all' })}>
                ניקוי הסינון
              </button>
            )}
            <button className={`chip ${route.links ? 'on' : ''}`} onClick={() => go({ links: !route.links, sec: 'all' })}>
              רק עם אתר
            </button>
            {!q && (
              <span className="seg">
                <button className={sort === 'date' ? 'on' : ''} onClick={() => setSort('date')}>
                  לפי תאריך
                </button>
                <button className={sort === 'alpha' ? 'on' : ''} onClick={() => setSort('alpha')}>
                  לפי שם
                </button>
              </span>
            )}
          </div>
        </header>
        {q && near && (
          <p className="expand-note">
            לא נמצאה התאמה מדויקת ל"{q}". אלה האפליקציות הקרובות ביותר.
          </p>
        )}
        {q && expanded.length > 0 && (
          <p className="expand-note">
            החיפוש "{q}" כולל גם את כל האפליקציות בסיווג: <b>{expanded.join(', ')}</b>
          </p>
        )}
        <Filters apps={searched} facets={facets} route={route} go={go} />
        {results.length === 0 ? (
          <div className="empty">
            <p>אין אפליקציות בצירוף הזה. זה פער, אולי רעיון לאפליקציה הבאה.</p>
            <span className="row">
              <button className="solid" onClick={() => onAdd({ action: route.action ?? undefined, domain: route.domain ?? undefined, name: q || undefined })}>
                הוספת אפליקציה חדשה
              </button>
              <button className="ghost" onClick={() => go({ q: '', action: null, domain: null, ctx: null, links: false, sec: 'all' })}>
                הצגת כל האפליקציות
              </button>
            </span>
          </div>
        ) : (
          <div className="grid">
            {results.map((a, i) => (
              <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={domainsOf(a)} why={reasons.get(a.id)} onOpen={() => go({ app: a.id })} index={i} />
            ))}
          </div>
        )}
      </section>
      )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

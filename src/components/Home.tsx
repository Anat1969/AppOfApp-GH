import { useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { ActionValue, AppData, Facet } from '../lib/types';
import { hasFilters, type Route } from '../lib/route';
import { createdOf, time } from '../lib/format';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';
import AppCard from './AppCard';
import Filters from './Filters';
import Matrix, { type AddPrefill } from './Matrix';
import Vocabulary from './Vocabulary';

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
  editing: boolean;
  vocab: { actions: ActionValue[]; domains: string[]; contexts: string[] };
  reasons: Map<string, string>;
  near: boolean;
  onAdd: (p?: AddPrefill) => void;
  saveFacet: (f: Facet) => Promise<boolean>;
  deleteFacet: (f: Facet) => Promise<boolean>;
}

export default function Home({ apps, results, searched, facets, sheets, route, go, sort, setSort, editing, vocab, reasons, near, onAdd, saveFacet, deleteFacet }: Props) {
  const { scrollY } = useScroll();
  const ghostY = useTransform(scrollY, [0, 600], [0, 140]);
  const titleY = useTransform(scrollY, [0, 600], [0, -40]);
  const filtering = hasFilters(route);
  const domainsOf = (a: AppData) => (a.domains ?? []).map((d) => facetLabel(facets, 'domain', d)).join(' · ');

  // Added and updated are two lists (Anat, 2026-11-04): an app counts as updated only when it changed after the day it was added.
  const MONTH = 30 * 86_400_000;
  const added = useMemo(() => apps.filter((a) => Date.now() - createdOf(a) < MONTH).sort((a, b) => createdOf(b) - createdOf(a)).slice(0, 6), [apps]);
  const updated = useMemo(
    () =>
      apps
        .filter((a) => {
          const u = time(a.updatedAt);
          return Date.now() - u < MONTH && u - createdOf(a) > 86_400_000;
        })
        .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
        .slice(0, 6),
    [apps],
  );

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

  return (
    <div className="home">
      <section className="hero">
        <motion.div className="hero-ghost" style={{ y: ghostY }} aria-hidden>
          Apps
        </motion.div>
        <motion.div className="hero-text" style={{ y: titleY }}>
          <div className="mono kicker">
            תיק אפליקציות · {apps.length} אפליקציות · {ACTIONS.length} פעולות · {facets.filter((f) => f.kind === 'domain').length} תחומים
          </div>
          <h1>
            בחר: תחום, נושא
            <br />
            או אפליקציה
          </h1>
          <p className="lead">כל גיליון פותח עולם שלם: בעיה, פתרון, ותוצר שעובד בפועל.</p>
          <div className="hero-cta">
            <button className="solid hero-add" onClick={() => onAdd()}>
              הוספת אפליקציה חדשה
            </button>
            <span className="dim">שם, קישור, פעולה ותחום. היא מקבלת מיד מקום במפה ובחיפוש.</span>
          </div>
        </motion.div>
        {/* "סרטון הדגמה": public/demo.js mounts the button here when aoa_apps holds a demo for this page. */}
        <div className="hero-demo" data-aoa-demo="large" />
      </section>

      {!filtering && (added.length > 0 || updated.length > 0) && (
        <section className="band band-screen">
          <header className="band-head">
            <span className="mono">01</span>
            <h2>חדש בתיק</h2>
            <span className="band-note">שלושים הימים האחרונים</span>
          </header>
          <div className="recent-split">
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

      {!filtering && (
        <section className="band band-screen band-map">
          <header className="band-head">
            <span className="mono">02</span>
            <h2>מפת התחומים והפעולות</h2>
            <span className="band-note">שורה היא תחום, עמודה היא מה יוצאים איתו. ריחוף על משבצת מציג את האפליקציות בה. משבצת ריקה היא פער, ובה הצעה לאפליקציה חדשה.</span>
          </header>
          <Matrix apps={apps} facets={facets} sheets={sheets} go={go} onAdd={onAdd} />
          {editing && <Vocabulary facets={facets} saveFacet={saveFacet} deleteFacet={deleteFacet} />}
        </section>
      )}

      <section className={`band ${filtering ? '' : 'band-screen'}`} id="catalog">
        <header className="band-head">
          <span className="mono">{filtering ? 'Q' : '03'}</span>
          <h2>{filtering ? `${results.length} אפליקציות` : 'כל הגיליונות'}</h2>
          {filtering && <span className="band-note">{summary.join(' · ')}</span>}
          <div className="filters">
            <button className="solid" onClick={() => onAdd({ action: route.action ?? undefined, domain: route.domain ?? undefined })}>
              הוספת אפליקציה
            </button>
            {filtering && (
              <button className="chip on" onClick={() => go({ q: '', action: null, domain: null, ctx: null, links: false })}>
                ניקוי הסינון
              </button>
            )}
            <button className={`chip ${route.links ? 'on' : ''}`} onClick={() => go({ links: !route.links })}>
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
              <button className="ghost" onClick={() => go({ q: '', action: null, domain: null, ctx: null, links: false })}>
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
    </div>
  );
}

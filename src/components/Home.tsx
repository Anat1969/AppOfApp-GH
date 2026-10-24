import { useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { ActionValue, AppData, Facet } from '../lib/types';
import { hasFilters, type Route } from '../lib/route';
import { activityOf } from '../lib/format';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';
import AppCard from './AppCard';
import Filters from './Filters';
import Matrix from './Matrix';
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
  saveFacet: (f: Facet) => Promise<boolean>;
  deleteFacet: (f: Facet) => Promise<boolean>;
}

export default function Home({ apps, results, searched, facets, sheets, route, go, sort, setSort, editing, vocab, saveFacet, deleteFacet }: Props) {
  const { scrollY } = useScroll();
  const ghostY = useTransform(scrollY, [0, 600], [0, 140]);
  const titleY = useTransform(scrollY, [0, 600], [0, -40]);
  const filtering = hasFilters(route);
  const domainsOf = (a: AppData) => (a.domains ?? []).map((d) => facetLabel(facets, 'domain', d)).join(' · ');

  const recent = useMemo(
    () => apps.filter((a) => Date.now() - activityOf(a) < 30 * 86_400_000).sort((a, b) => activityOf(b) - activityOf(a)).slice(0, 6),
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
            PORTFOLIO · {apps.length} APPS · {ACTIONS.length} ACTIONS · {facets.filter((f) => f.kind === 'domain').length} DOMAINS
          </div>
          <h1>
            בחר: תחום, נושא
            <br />
            או אפליקציה
          </h1>
          <p className="lead">כל גיליון פותח עולם שלם: בעיה, פתרון, ותוצר שעובד בפועל.</p>
        </motion.div>
      </section>

      {!filtering && recent.length > 0 && (
        <section className="band">
          <header className="band-head">
            <span className="mono">01</span>
            <h2>נוספו או עודכנו לאחרונה</h2>
          </header>
          <div className="recent">
            {recent.map((a, i) => (
              <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={domainsOf(a)} onOpen={() => go({ app: a.id })} index={i} compact />
            ))}
          </div>
        </section>
      )}

      {!filtering && (
        <section className="band">
          <header className="band-head">
            <span className="mono">02</span>
            <h2>מפת התחומים והפעולות</h2>
            <span className="band-note">שורה היא תחום, עמודה היא מה יוצאים איתו. משבצת ריקה היא פער: אין עדיין אפליקציה כזו.</span>
          </header>
          <Matrix apps={apps} facets={facets} go={go} />
          {editing && <Vocabulary facets={facets} saveFacet={saveFacet} deleteFacet={deleteFacet} />}
        </section>
      )}

      <section className="band" id="catalog">
        <header className="band-head">
          <span className="mono">{filtering ? 'Q' : '03'}</span>
          <h2>{filtering ? `${results.length} אפליקציות` : 'כל הגיליונות'}</h2>
          {filtering && <span className="band-note">{summary.join(' · ')}</span>}
          <div className="filters">
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
        {q && expanded.length > 0 && (
          <p className="expand-note">
            החיפוש "{q}" כולל גם את כל האפליקציות בסיווג: <b>{expanded.join(', ')}</b>
          </p>
        )}
        <Filters apps={searched} facets={facets} route={route} go={go} />
        {results.length === 0 ? (
          <div className="empty">
            <p>אין אפליקציות בצירוף הזה. זה פער, אולי רעיון לאפליקציה הבאה.</p>
            <button className="solid" onClick={() => go({ q: '', action: null, domain: null, ctx: null, links: false })}>
              הצגת כל האפליקציות
            </button>
          </div>
        ) : (
          <div className="grid">
            {results.map((a, i) => (
              <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={domainsOf(a)} onOpen={() => go({ app: a.id })} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIONS, actionOf, facetLabel } from '../lib/facets';
import { clean, siteUrl } from '../lib/format';
import type { AppData, Facet } from '../lib/types';
import Toasts, { toast } from '../components/Toasts';
import { DEV_SESSION_URL } from '../components/AIMenu';
import { KIND, fmtDate, fmtTime, programme, toReels, useCinema, type Film, type Reel } from './data';

type Tab = 'hall' | 'all' | 'gaps';
const TABS: { id: Tab; label: string }[] = [
  { id: 'hall', label: 'האולם' },
  { id: 'all', label: 'כל הסרטים' },
  { id: 'gaps', label: 'מה חסר' },
];
interface Route { tab: Tab; kind: '' | Film['kind']; domain: string; app: string; film: string }

const readRoute = (): Route => {
  const p = new URLSearchParams(location.search);
  const tab = p.get('tab');
  const kind = p.get('kind');
  return {
    tab: tab === 'all' || tab === 'gaps' ? tab : 'hall',
    kind: kind === 'demo' || kind === 'creation' ? kind : '',
    domain: p.get('domain') ?? '',
    app: p.get('app') ?? '',
    film: p.get('film') ?? '',
  };
};
const writeRoute = (r: Route) => {
  const p = new URLSearchParams();
  if (r.tab !== 'hall') p.set('tab', r.tab);
  if (r.kind) p.set('kind', r.kind);
  if (r.domain) p.set('domain', r.domain);
  if (r.app) p.set('app', r.app);
  if (r.film) p.set('film', r.film);
  const s = p.toString();
  return `${location.pathname}${s ? `?${s}` : ''}`;
};

const PORTFOLIO = new URL('..', location.href).pathname;
/** Subject labels of a film; a value with no vocabulary entry is left out, never shown as "לא מסווג". */
const labels = (facets: Facet[], subjects: string[]) => subjects.map((d) => facetLabel(facets, 'domain', d)).filter((l) => l !== 'לא מסווג').slice(0, 2);
const firstSentence = (t?: string) => clean(t).replace(/\*\*/g, '').split(/(?<=[.!?])\s|\n/)[0]?.slice(0, 150) ?? '';
const copy = async (text: string, done: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('ההעתקה נחסמה בדפדפן הזה', 'error');
  }
};

export default function App() {
  const store = useCinema();
  const [route, setRoute] = useState<Route>(readRoute);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9) + 1);
  const [adding, setAdding] = useState(false);
  const menu = useRef<HTMLElement & { items: unknown[]; status: string }>(null);

  const go = useCallback((patch: Partial<Route>, replace = false) => {
    setRoute((prev) => {
      const next = { ...prev, ...patch };
      const url = writeRoute(next);
      if (url !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState'](null, '', url);
      return next;
    });
  }, []);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);

  const reels = useMemo(() => toReels(store.films, store.apps), [store.films, store.apps]);
  const showing = useMemo(() => reels.filter((r) => r.showing), [reels]);

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    el.items = [
      { label: 'הוספת סרט', onSelect: () => { go({ tab: 'all' }); setAdding(true); } },
      { label: 'רענון רשימת הסרטים', onSelect: () => store.reload(true).then(() => toast('הרשימה עודכנה')) },
      { label: 'לתיק האפליקציות', onSelect: () => (location.href = PORTFOLIO) },
    ];
    el.status = store.savedAt ? `נשמר ${new Date(store.savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : '';
  }, [go, store]);

  useEffect(() => {
    document.title = route.tab === 'hall' ? 'קולנוע האפליקציות' : `${TABS.find((t) => t.id === route.tab)!.label} · קולנוע האפליקציות`;
  }, [route.tab]);

  return (
    <div className="cin-shell">
      <header className="topbar cin-bar">
        <div className="topbar-inner">
          <a className="brand" href={location.pathname} onClick={(e) => { e.preventDefault(); go({ tab: 'hall', kind: '', domain: '', app: '', film: '' }); }}>
            <span className="brand-name">קולנוע האפליקציות</span>
            <span className="brand-sub">{showing.length ? `${showing.length} סרטים` : ''}</span>
          </a>
          <span />
          <nav className="actions" aria-label="חלקי הקולנוע">
            {TABS.map((t) => (
              <button key={t.id} className={`tab ${route.tab === t.id ? 'on' : ''}`} aria-current={route.tab === t.id ? 'page' : undefined} onClick={() => go({ tab: t.id })}>
                {t.label}
              </button>
            ))}
            <span className="sep" aria-hidden />
            <a className="tab cin-back" href={PORTFOLIO}>תיק האפליקציות</a>
            <ai-menu ref={menu} chat={DEV_SESSION_URL} />
          </nav>
        </div>
      </header>

      <main className="cin">
        {store.loading ? (
          <div className="state"><div className="loader" aria-hidden><span /><span /><span /></div><p className="mono">טוען את הסרטים</p></div>
        ) : store.error ? (
          <div className="state"><p>{store.error}</p><button className="solid" onClick={() => store.reload()}>ניסיון נוסף</button></div>
        ) : route.tab === 'all' ? (
          <AllFilms reels={reels} store={store} adding={adding} setAdding={setAdding} go={go} />
        ) : route.tab === 'gaps' ? (
          <Gaps reels={reels} apps={store.apps} facets={store.facets} go={go} />
        ) : (
          <Hall showing={showing} route={route} go={go} facets={store.facets} seed={seed} reseed={() => setSeed(Math.floor(Math.random() * 1e9) + 1)} arrived={store.arrived} />
        )}
      </main>
      <Toasts />
    </div>
  );
}

/* ---------- the hall: one screen, one programme ---------- */

function Thumb({ reel }: { reel: Reel }) {
  const box = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (reel.poster || !box.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '200px' });
    io.observe(box.current);
    return () => io.disconnect();
  }, [reel.poster]);
  return (
    <span className="cin-thumb" ref={box}>
      {reel.poster ? <img src={reel.poster} alt="" loading="lazy" /> : near && reel.url ? <video src={`${reel.url}#t=1`} preload="metadata" muted playsInline tabIndex={-1} /> : null}
    </span>
  );
}

function Hall({ showing, route, go, facets, seed, reseed, arrived }: { showing: Reel[]; route: Route; go: (p: Partial<Route>, replace?: boolean) => void; facets: Facet[]; seed: number; reseed: () => void; arrived: string[] }) {
  const list = useMemo(() => {
    const f = showing.filter((r) => (!route.kind || r.kind === route.kind) && (!route.domain || r.subjects.includes(route.domain)) && (!route.app || r.app_id === route.app));
    return programme(f, seed);
  }, [showing, route.kind, route.domain, route.app, seed]);
  const now = list.find((r) => r.key === route.film) ?? list[0];
  const idx = now ? list.indexOf(now) : -1;
  const next = idx >= 0 ? list[idx + 1] : undefined;
  const prev = idx > 0 ? list[idx - 1] : undefined;

  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [pause, setPause] = useState<number | null>(null); // seconds left of the intermission
  const [length, setLength] = useState<number | null>(null);

  const play = (r: Reel) => {
    setPause(null);
    setStarted(true);
    go({ film: r.key }, true);
  };

  // once the visitor pressed play, every film that comes up starts by itself, with sound
  useEffect(() => {
    setLength(null);
    const v = video.current;
    if (!v || !now) return;
    const speed = Number((now.app?.demo as { speed?: number } | undefined)?.speed);
    v.playbackRate = now.kind === 'demo' && speed > 0 ? speed : 1;
    if (started) v.play().catch(() => setStarted(false));
  }, [now?.key, started]); // eslint-disable-line react-hooks/exhaustive-deps

  // intermission: a title card names the next film, then it starts
  useEffect(() => {
    if (pause === null) return;
    if (pause <= 0) {
      if (next) play(next);
      return;
    }
    const t = setTimeout(() => setPause((p) => (p === null ? null : p - 1)), 1000);
    return () => clearTimeout(t);
  }, [pause]); // eslint-disable-line react-hooks/exhaustive-deps

  const domains = facets.filter((f) => f.kind === 'domain' && showing.some((r) => r.subjects.includes(f.value)));
  const appsWith = [...new Map(showing.filter((r) => r.app).map((r) => [r.app_id!, r.app!])).values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const filtered = !!(route.kind || route.domain || route.app);

  if (!showing.length) return <div className="state"><p>עדיין אין סרטים להקרנה.</p><button className="solid" onClick={() => go({ tab: 'all' })}>הוספת סרט ראשון</button></div>;

  const site = now?.app ? siteUrl(now.app) : undefined;
  const action = actionOf(now?.app?.action);
  return (
    <>
      <div className="cin-filters">
        <div className="seg" role="group" aria-label="סוג הסרט">
          {(['', 'demo', 'creation'] as const).map((k) => (
            <button key={k} className={route.kind === k ? 'on' : ''} onClick={() => go({ kind: k, film: '' })}>
              {k ? `${KIND[k]} (${showing.filter((r) => r.kind === k).length})` : `הכול (${showing.length})`}
            </button>
          ))}
        </div>
        <div className="cin-chips">
          {domains.map((d) => (
            <button key={d.value} className={`chip ${route.domain === d.value ? 'on' : ''}`} onClick={() => go({ domain: route.domain === d.value ? '' : d.value, film: '' })}>
              {d.label}
            </button>
          ))}
        </div>
        <select value={route.app} onChange={(e) => go({ app: e.target.value, film: '' })} aria-label="אפליקציה">
          <option value="">כל האפליקציות</option>
          {appsWith.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {filtered && <button className="link" onClick={() => go({ kind: '', domain: '', app: '', film: '' })}>ניקוי הסינון</button>}
      </div>

      {!now ? (
        <div className="state"><p>אין סרט שמתאים לסינון הזה.</p><button className="solid" onClick={() => go({ kind: '', domain: '', app: '', film: '' })}>כל הסרטים</button></div>
      ) : (
        <div className="cin-hall">
          <section className="cin-stage" aria-label="המסך">
            <div className="cin-screen">
              <video
                ref={video}
                key={now.key}
                src={now.url!}
                poster={now.poster ?? undefined}
                controls={started}
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => setLength(e.currentTarget.duration / (e.currentTarget.playbackRate || 1))}
                onEnded={() => setPause(next ? 4 : 0)}
              />
              {!started && (
                <button className="cin-go" onClick={() => setStarted(true)}>
                  <b>הפעלה</b>
                  <span>{list.length > 1 ? `${list.length} סרטים בתוכנייה, אחד אחרי השני` : 'סרט אחד בתוכנייה'}</span>
                </button>
              )}
              {pause !== null && (
                <div className="cin-inter" role="status">
                  {next ? (
                    <>
                      <span className="mono">הבא בתוכנייה · {pause}</span>
                      <b>{next.name}</b>
                      <span>{next.app?.name !== next.name ? next.app?.name : KIND[next.kind]}</span>
                      <div className="cin-inter-btns">
                        <button className="solid" onClick={() => play(next)}>המשך עכשיו</button>
                        <button className="ghost" onClick={() => setPause(null)}>עצירה</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="mono">סוף התוכנייה</span>
                      <b>{list.length} סרטים הוקרנו</b>
                      <div className="cin-inter-btns">
                        <button className="solid" onClick={() => { reseed(); setPause(null); go({ film: '' }, true); }}>תוכנייה חדשה</button>
                        <button className="ghost" onClick={() => setPause(null)}>סגירה</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="cin-card">
              <div className="cin-card-text">
                <p className="cin-kicker">
                  <span className={`cin-kind k-${now.kind}`}>{KIND[now.kind]}</span>
                  {labels(facets, now.subjects).map((l) => <span key={l}>{l}</span>)}
                  {action && <span>{action.label}</span>}
                  <span className="mono">{fmtTime(now.duration && now.kind === 'demo' ? length ?? now.duration : length)}</span>
                </p>
                <h1>{now.name}</h1>
                <p className="cin-lead">
                  {now.app && now.app.name !== now.name && <b>{now.app.name}. </b>}
                  {now.note || firstSentence(now.app?.desc) || firstSentence(now.app?.solution)}
                </p>
              </div>
              <div className="cin-card-btns">
                {site && <a className="solid big" href={site} target="_blank" rel="noreferrer">פתיחת האפליקציה</a>}
                {now.app && <a className="ghost" href={`${PORTFOLIO}?app=${encodeURIComponent(now.app.id)}`}>הדף בתיק</a>}
                <button className="ghost" onClick={() => copy(`${location.origin}${location.pathname}?film=${encodeURIComponent(now.key)}`, 'הקישור לסרט הועתק')}>העתקת קישור לסרט</button>
              </div>
              <div className="cin-nav">
                <button className="ghost" disabled={!prev} onClick={() => prev && play(prev)}>הקודם</button>
                <span className="mono">{idx + 1} מתוך {list.length}</span>
                <button className="ghost" disabled={!next} onClick={() => next && play(next)}>הבא</button>
              </div>
            </div>
          </section>

          <aside className="cin-prog" aria-label="התוכנייה">
            <header>
              <div>
                <b>התוכנייה</b>
                <span className="mono">{filtered ? 'לפי הסינון' : 'מתחלפת בכל כניסה, מתחום לתחום'}</span>
              </div>
              <button className="ghost" onClick={() => { reseed(); go({ film: '' }, true); }}>ערבוב</button>
            </header>
            <ol>
              {list.map((r, i) => (
                <li key={r.key}>
                  <button className={`cin-item ${r.key === now.key ? 'on' : ''}`} aria-current={r.key === now.key ? 'true' : undefined} onClick={() => play(r)}>
                    <span className="mono cin-no">{String(i + 1).padStart(2, '0')}</span>
                    <Thumb reel={r} />
                    <span className="cin-item-text">
                      <b>{r.name}</b>
                      <span>
                        {r.app && r.app.name !== r.name ? `${r.app.name} · ` : ''}{KIND[r.kind]}
                        {(arrived.includes(r.key) || r.isNew) && <em className="cin-new">חדש</em>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </>
  );
}

/* ---------- all films: the projection room ---------- */

type Status = 'showing' | 'old' | 'private' | 'hidden' | 'all';
const STATUS: { id: Status; label: string; test: (r: Reel) => boolean; why: string }[] = [
  { id: 'showing', label: 'בהקרנה', test: (r) => r.showing, why: 'מוקרנים באולם' },
  { id: 'old', label: 'גרסאות קודמות', test: (r) => r.old, why: 'צילומים קודמים של סרטון הדגמה. נשמרים, לא מוקרנים' },
  { id: 'private', label: 'נעולים', test: (r) => r.private, why: 'האחסון של האפליקציה פרטי, ולכן אי אפשר להקרין אותם לציבור' },
  { id: 'hidden', label: 'מוסתרים', test: (r) => r.hidden, why: 'הוסתרו מהאולם ביד' },
  { id: 'all', label: 'הכול', test: () => true, why: 'כל קובץ וידאו שנמצא' },
];
type SortKey = 'date' | 'app' | 'kind' | 'name';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'date', label: 'תאריך' },
  { id: 'app', label: 'אפליקציה' },
  { id: 'kind', label: 'סוג' },
  { id: 'name', label: 'שם' },
];

function AllFilms({ reels, store, adding, setAdding, go }: { reels: Reel[]; store: ReturnType<typeof useCinema>; adding: boolean; setAdding: (b: boolean) => void; go: (p: Partial<Route>) => void }) {
  const [status, setStatus] = useState<Status>('showing');
  const [sort, setSort] = useState<SortKey>('date');
  const [open, setOpen] = useState('');
  const st = STATUS.find((s) => s.id === status)!;
  const rows = useMemo(() => {
    const list = reels.filter(st.test);
    const by: Record<SortKey, (a: Reel, b: Reel) => number> = {
      date: (a, b) => b.created_at.localeCompare(a.created_at),
      app: (a, b) => (a.app?.name ?? 'תתת').localeCompare(b.app?.name ?? 'תתת', 'he') || b.created_at.localeCompare(a.created_at),
      kind: (a, b) => a.kind.localeCompare(b.kind) || b.created_at.localeCompare(a.created_at),
      name: (a, b) => a.name.localeCompare(b.name, 'he'),
    };
    return list.sort(by[sort]);
  }, [reels, st, sort]);
  const save = (key: string, patch: Partial<Film>) => store.save(key, patch).catch((e) => toast(`השמירה לא עברה: ${(e as Error).message}`, 'error'));
  const group = (r: Reel) => (sort === 'app' ? r.app?.name ?? 'בלי אפליקציה' : sort === 'kind' ? KIND[r.kind] : '');

  return (
    <section className="cin-all">
      <header className="cin-head">
        <div>
          <h1>כל הסרטים</h1>
          <p>הרשימה נקראת ישר מהאחסון של האפליקציות: <b>סרט חדש מופיע כאן לבד</b>, בלי רישום. כאן קובעים לו שם, נושא ואפליקציה.</p>
        </div>
        <button className="solid big" onClick={() => setAdding(!adding)}>{adding ? 'סגירה' : 'הוספת סרט'}</button>
      </header>
      {adding && <AddFilm store={store} onDone={() => setAdding(false)} />}

      <div className="cin-tools">
        <div className="seg" role="group" aria-label="מצב">
          {STATUS.map((s) => (
            <button key={s.id} className={status === s.id ? 'on' : ''} onClick={() => setStatus(s.id)}>{s.label} ({reels.filter(s.test).length})</button>
          ))}
        </div>
        <span className="cin-why">{st.why}.</span>
        <label className="cin-sort">מיון לפי
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        </label>
      </div>

      {!rows.length ? (
        <p className="cin-empty">אין סרטים במצב הזה.</p>
      ) : (
        <ul className="cin-rows">
          {rows.map((r, i) => {
            const g = group(r);
            return (
              <li key={r.key}>
                {g && (i === 0 || group(rows[i - 1]) !== g) && <h2 className="cin-group">{g} <span className="mono">{rows.filter((x) => group(x) === g).length}</span></h2>}
                <div className={`cin-row ${open === r.key ? 'open' : ''}`}>
                  <Thumb reel={r} />
                  <div className="cin-row-main">
                    <input
                      className="cin-title"
                      defaultValue={r.name}
                      key={r.name}
                      aria-label="שם הסרט"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.name) save(r.key, { title: v }); }}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                    <span className="cin-meta">
                      <span className={`cin-kind k-${r.kind}`}>{KIND[r.kind]}</span>
                      <span>{r.app?.name ?? 'בלי אפליקציה'}</span>
                      {labels(store.facets, r.subjects).map((l) => <span key={l}>{l}</span>)}
                      <span className="mono">{fmtDate(r.created_at)}{r.duration ? ` · ${fmtTime(r.duration)}` : ''}{r.size ? ` · ${(r.size / 1048576).toFixed(1)}MB` : ''}</span>
                      {r.featured && <em className="cin-new">סרט פתיחה</em>}
                      {r.isNew && <em className="cin-new">חדש</em>}
                    </span>
                  </div>
                  <div className="cin-row-btns">
                    {r.showing && <button className="ghost" onClick={() => go({ tab: 'hall', film: r.key, kind: '', domain: '', app: '' })}>הקרנה</button>}
                    <button className="ghost" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? '' : r.key)}>{open === r.key ? 'סגירה' : 'עריכה'}</button>
                  </div>
                </div>
                {open === r.key && (
                  <div className="cin-edit">
                    <label>אפליקציה
                      <select value={r.app_id ?? ''} onChange={(e) => save(r.key, { app_id: e.target.value })}>
                        <option value="">בלי אפליקציה</option>
                        {[...store.apps].sort((a, b) => a.name.localeCompare(b.name, 'he')).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                    <label>סוג
                      <span className="seg">
                        {(['demo', 'creation'] as const).map((k) => <button key={k} className={r.kind === k ? 'on' : ''} onClick={() => save(r.key, { kind: k })}>{KIND[k]}</button>)}
                      </span>
                    </label>
                    <div className="cin-edit-wide">נושא <span className="mono">{r.domains?.length ? 'נקבע לסרט' : 'כמו האפליקציה'}</span>
                      <div className="cin-chips">
                        {store.facets.filter((f) => f.kind === 'domain').map((f) => (
                          <button key={f.value} className={`chip ${r.subjects.includes(f.value) ? 'on' : ''}`} onClick={() => save(r.key, { domains: r.subjects.includes(f.value) ? r.subjects.filter((x) => x !== f.value) : [...r.subjects, f.value] })}>{f.label}</button>
                        ))}
                      </div>
                    </div>
                    <label className="cin-edit-wide">משפט על הסרט
                      <input defaultValue={r.note ?? ''} placeholder="מוצג מתחת למסך. ריק: המשפט הראשון של תיאור האפליקציה" onBlur={(e) => e.target.value !== (r.note ?? '') && save(r.key, { note: e.target.value })} />
                    </label>
                    <div className="cin-edit-btns">
                      <button className={`ghost ${r.featured ? 'pressed' : ''}`} aria-pressed={r.featured} onClick={() => save(r.key, { featured: !r.featured })}>{r.featured ? 'סרט פתיחה: כן' : 'קביעה כסרט פתיחה'}</button>
                      <button className={`ghost ${r.hidden ? 'pressed' : ''}`} aria-pressed={r.hidden} onClick={() => save(r.key, { hidden: !r.hidden })}>{r.hidden ? 'מוסתר: החזרה לאולם' : 'הסתרה מהאולם'}</button>
                      {r.url && <a className="ghost" href={r.url} target="_blank" rel="noreferrer">פתיחת הקובץ</a>}
                      <button className="link" onClick={() => store.reset(r.key).then(() => toast(r.key.startsWith('link:') ? 'הסרט הוסר' : 'חזר לברירת המחדל')).catch((e) => toast((e as Error).message, 'error'))}>
                        {r.key.startsWith('link:') ? 'הסרת הסרט' : 'איפוס לברירת המחדל'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddFilm({ store, onDone }: { store: ReturnType<typeof useCinema>; onDone: () => void }) {
  const [appId, setAppId] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const apps = useMemo(() => [...store.apps].sort((a, b) => a.name.localeCompare(b.name, 'he')), [store.apps]);

  const send = async (f?: File | null, url?: string) => {
    if (!appId) return toast('קודם בוחרים לאיזו אפליקציה הסרט שייך', 'error');
    if (f && !f.type.startsWith('video/')) return toast('זה לא קובץ וידאו', 'error');
    if (!f && !/^https:\/\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(url ?? '')) return toast('הקישור צריך להתחיל ב-https ולהסתיים בקובץ וידאו, למשל mp4', 'error');
    setBusy(f ? `מעלה ${(f.size / 1048576).toFixed(1)}MB...` : 'שומר...');
    try {
      if (f) await store.upload(appId, f, title);
      else await store.addLink(appId, url!, title);
      toast('הסרט נכנס לתוכנייה');
      onDone();
    } catch (e) {
      toast(`ההוספה לא עברה: ${(e as Error).message}`, 'error');
    }
    setBusy('');
  };

  // upload is always click, paste and drag
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('video/'));
      const t = e.clipboardData?.getData('text') ?? '';
      if (f) send(f);
      else if (/^https:\/\/\S+$/.test(t.trim()) && !(e.target instanceof HTMLInputElement)) setLink(t.trim());
    };
    addEventListener('paste', paste);
    return () => removeEventListener('paste', paste);
  });

  return (
    <div className="cin-add">
      <label>01 · אפליקציה
        <select value={appId} onChange={(e) => setAppId(e.target.value)}>
          <option value="">בחירה</option>
          {apps.map((a: AppData) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label>02 · שם הסרט <span className="mono">לא חובה</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className={`cin-drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files[0]); }}>
        <span>03 · הקובץ: גרירה לכאן, הדבקה, או</span>
        <button className="solid" disabled={!!busy} onClick={() => file.current?.click()}>{busy || 'בחירת קובץ'}</button>
        <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { send(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <label className="cin-add-link">או קישור לקובץ וידאו
        <span><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://.../film.mp4" dir="ltr" /><button className="ghost" disabled={!link || !!busy} onClick={() => send(null, link.trim())}>הוספה</button></span>
      </label>
    </div>
  );
}

/* ---------- what is missing ---------- */

function Gaps({ reels, apps, facets, go }: { reels: Reel[]; apps: AppData[]; facets: Facet[]; go: (p: Partial<Route>) => void }) {
  const [domain, setDomain] = useState('');
  const showing = reels.filter((r) => r.showing);
  const has = new Set(showing.map((r) => r.app_id));
  const hasDemo = new Set(showing.filter((r) => r.kind === 'demo').map((r) => r.app_id));
  const locked = reels.filter((r) => r.private);
  const lockedApps = [...new Set(locked.map((r) => r.app?.name).filter(Boolean))];
  const live = apps.filter((a) => !!siteUrl(a));
  const missing = live.filter((a) => !has.has(a.id) && (!domain || a.domains?.includes(domain))).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  const rowsOf = (list: { value: string; label: string }[], v: (x: string) => (a: AppData) => boolean | undefined) =>
    list.map((x) => {
      const all = live.filter(v(x.value));
      return { value: x.value, label: x.label, all: all.length, with: all.filter((a) => has.has(a.id)).length };
    }).filter((x) => x.all > 0);
  const domains = rowsOf(facets.filter((f) => f.kind === 'domain'), (x) => (a) => a.domains?.includes(x));
  const actions = rowsOf(ACTIONS, (x) => (a) => a.action === x);
  const ask = (a: AppData) =>
    `צור סרטון הדגמה לאפליקציה "${a.name}" (${siteUrl(a)}), לפי הסקיל anat-demo-video ובאיכות הסרטון של פרטיטורה: כדקה, מצולם מתוך האפליקציה עצמה מול הנתונים האמיתיים, קול Aoede, מנגינה שעוד לא נלקחה. שמור אותו ב-aoa-media/${a.id}/demo-<זמן>.mp4 ועדכן את data.demo של ${a.id} ב-aoa_apps, כולל poster ו-share. הסרט ייכנס לקולנוע האפליקציות לבד.`;

  const Bars = ({ title, rows, pick }: { title: string; rows: typeof domains; pick?: (v: string) => void }) => (
    <div className="cin-bars">
      <h2>{title}</h2>
      {rows.map((x) => (
        <button key={x.value} className={`cin-bar-row ${domain === x.value && pick ? 'on' : ''}`} disabled={!pick} onClick={() => pick?.(x.value)}>
          <span>{x.label}</span>
          <span className="cin-track"><i style={{ width: `${(x.with / x.all) * 100}%` }} /></span>
          <span className="mono"><b>{x.with}</b> מתוך {x.all}</span>
        </button>
      ))}
    </div>
  );

  return (
    <section className="cin-gaps">
      <header className="cin-head">
        <div>
          <h1><b className="cin-red">{live.length - live.filter((a) => has.has(a.id)).length}</b> אפליקציות עוד בלי סרט</h1>
          <p>ל-<b>{live.filter((a) => has.has(a.id)).length}</b> מתוך <b>{live.length}</b> אפליקציות עם כתובת יש סרט באולם, ול-<b>{hasDemo.size}</b> מהן סרטון הדגמה. הפס הירוק: כמה אפליקציות בקבוצה כבר מוקרנות.</p>
          {locked.length > 0 && <p className="cin-note"><b>{locked.length}</b> סרטים של {lockedApps.join(', ')} נעולים: האחסון שלהם פרטי, ולכן הם לא באולם.</p>}
        </div>
      </header>
      <div className="cin-gaps-grid">
        <Bars title="לפי תחום · לחיצה מסננת את הרשימה" rows={domains} pick={(v) => setDomain(domain === v ? '' : v)} />
        <Bars title="לפי פעולה" rows={actions} />
        <div className="cin-missing">
          <h2>בלי סרט{domain ? ` · ${facetLabel(facets, 'domain', domain)}` : ''} <span className="mono">{missing.length} · המעודכנות קודם</span></h2>
          <ol>
            {missing.map((a) => (
              <li key={a.id}>
                <a className="link strong" href={`${PORTFOLIO}?app=${encodeURIComponent(a.id)}`}>{a.name}</a>
                <span className="mono">{actionOf(a.action)?.short ?? ''}</span>
                <button className="ghost" onClick={() => copy(ask(a), 'הבקשה לסרטון הועתקה. מדביקים אותה בשיחה עם Claude')}>העתקת בקשה לסרטון</button>
              </li>
            ))}
          </ol>
          {!missing.length && <p className="cin-empty">לכל האפליקציות בקבוצה הזאת יש סרט.</p>}
          <button className="link" onClick={() => go({ tab: 'all' })}>יש לי סרט מוכן: הוספה ברשימת הסרטים</button>
        </div>
      </div>
    </section>
  );
}

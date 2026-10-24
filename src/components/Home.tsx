import { useMemo } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { AppData, Category } from '../lib/types';
import type { Route } from '../lib/route';
import { activityOf, thumbOf } from '../lib/format';
import AppCard from './AppCard';
import { toast } from './Toasts';

interface Props {
  apps: AppData[];
  results: AppData[];
  categories: Category[];
  sheets: Map<string, string>;
  route: Route;
  go: (p: Partial<Route>) => void;
  sort: 'date' | 'alpha';
  setSort: (s: 'date' | 'alpha') => void;
  editing: boolean;
  saveCategory: (c: Category) => Promise<boolean>;
  deleteCategory: (v: string) => Promise<boolean>;
}

export default function Home({ apps, results, categories, sheets, route, go, sort, setSort, editing, saveCategory, deleteCategory }: Props) {
  const { scrollY } = useScroll();
  const ghostY = useTransform(scrollY, [0, 600], [0, 140]);
  const titleY = useTransform(scrollY, [0, 600], [0, -40]);
  const catLabel = (v?: string | null) => categories.find((c) => c.value === v)?.label ?? '';
  const filtering = !!(route.q.trim() || route.cat || route.links);

  const rooms = useMemo(() => {
    const list = categories.map((c) => ({ ...c, apps: apps.filter((a) => a.category === c.value).sort((a, b) => activityOf(b) - activityOf(a)) }));
    const none = apps.filter((a) => !a.category || !categories.some((c) => c.value === a.category));
    if (none.length) list.push({ value: '__none', label: 'ללא קטגוריה', position: 999, apps: none });
    return list.sort((a, b) => b.apps.length - a.apps.length);
  }, [apps, categories]);
  const max = Math.max(1, ...rooms.map((r) => r.apps.length));

  const recent = useMemo(
    () => apps.filter((a) => Date.now() - activityOf(a) < 30 * 86_400_000).sort((a, b) => activityOf(b) - activityOf(a)).slice(0, 6),
    [apps],
  );

  const addCategory = async () => {
    const label = prompt('שם הקטגוריה החדשה')?.trim();
    if (!label) return;
    if (await saveCategory({ value: `custom-${Date.now()}`, label, position: categories.length })) toast('הקטגוריה נוספה');
  };

  return (
    <div className="home">
      <section className="hero">
        <motion.div className="hero-ghost" style={{ y: ghostY }} aria-hidden>
          Apps
        </motion.div>
        <motion.div className="hero-text" style={{ y: titleY }}>
          <div className="mono kicker">PORTFOLIO · {apps.length} APPS · {categories.length} DOMAINS</div>
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
              <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={catLabel(a.category)} onOpen={() => go({ app: a.id })} index={i} compact />
            ))}
          </div>
        </section>
      )}

      {!filtering && (
        <section className="band">
          <header className="band-head">
            <span className="mono">02</span>
            <h2>תוכנית התחומים</h2>
            <span className="band-note">כל חדר הוא תחום. הגודל לפי מספר האפליקציות.</span>
          </header>
          <div className="plan">
            {rooms.map((r, i) => (
              <motion.div
                key={r.value}
                className="room"
                style={{ ['--w' as string]: Math.max(2, Math.round((r.apps.length / max) * 6)) }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + Math.min(i, 12) * 0.035 }}
              >
                <button className="room-hit" onClick={() => go({ cat: r.value === '__none' ? null : r.value, q: '' })} disabled={r.value === '__none'}>
                  <span className="room-layers" aria-hidden>
                    {r.apps.slice(0, 3).map((a, k) => {
                      const t = thumbOf(a);
                      return t ? <img key={a.id} src={t} alt="" loading="lazy" style={{ ['--k' as string]: k }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : null;
                    })}
                  </span>
                  <span className="room-label">{r.label}</span>
                  <span className="room-count mono">{String(r.apps.length).padStart(2, '0')}</span>
                </button>
                {editing && r.value !== '__none' && (
                  <span className="room-tools">
                    <button
                      onClick={async () => {
                        const label = prompt('שם חדש לקטגוריה', r.label)?.trim();
                        if (label && label !== r.label && (await saveCategory({ value: r.value, label, position: r.position }))) toast('הקטגוריה עודכנה');
                      }}
                    >
                      שינוי שם
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`למחוק את הקטגוריה "${r.label}"? האפליקציות יישארו ללא קטגוריה.`) && (await deleteCategory(r.value))) toast('הקטגוריה נמחקה');
                      }}
                    >
                      מחיקה
                    </button>
                  </span>
                )}
              </motion.div>
            ))}
            {editing && (
              <button className="room room-add" onClick={addCategory}>
                קטגוריה חדשה
              </button>
            )}
          </div>
        </section>
      )}

      <section className="band" id="catalog">
        <header className="band-head">
          <span className="mono">{filtering ? 'Q' : '03'}</span>
          <h2>{filtering ? `${results.length} תוצאות` : 'כל הגיליונות'}</h2>
          <div className="filters">
            {route.cat && (
              <button className="chip on" onClick={() => go({ cat: null })}>
                {catLabel(route.cat)} · הסרה
              </button>
            )}
            {route.q.trim() && (
              <button className="chip on" onClick={() => go({ q: '' })}>
                "{route.q.trim()}" · הסרה
              </button>
            )}
            <button className={`chip ${route.links ? 'on' : ''}`} onClick={() => go({ links: !route.links })}>
              רק עם אתר
            </button>
            {!route.q.trim() && (
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
        <div className="cat-strip" role="tablist" aria-label="קטגוריות">
          <button className={`chip ${!route.cat ? 'on' : ''}`} onClick={() => go({ cat: null })}>
            הכל <span className="mono">{apps.length}</span>
          </button>
          {rooms
            .filter((r) => r.value !== '__none')
            .map((r) => (
              <button key={r.value} className={`chip ${route.cat === r.value ? 'on' : ''}`} onClick={() => go({ cat: route.cat === r.value ? null : r.value, q: '' })}>
                {r.label} <span className="mono">{r.apps.length}</span>
              </button>
            ))}
        </div>
        {results.length === 0 ? (
          <div className="empty">
            <p>לא נמצאו אפליקציות.</p>
            <button className="solid" onClick={() => go({ q: '', cat: null, links: false })}>
              הצגת כל האפליקציות
            </button>
          </div>
        ) : (
          <div className="grid">
            {results.map((a, i) => (
              <AppCard key={a.id} app={a} sheet={sheets.get(a.id) ?? ''} category={catLabel(a.category)} onOpen={() => go({ app: a.id })} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

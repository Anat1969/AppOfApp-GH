import { useEffect, useMemo, useState } from 'react';
import { ACTIONS, APP_OF_APP, DISCS, SNAPSHOT, SNAPSHOT_DATE, analyse, anchors, loadLive, pct, promptFor, yearLabel, type App as AppT, type Hit } from './engine';
import { Rich } from './Rich';
import { Dialog, InfoIcon } from './Dialog';

const KEY = 'chorim.rejected.v1';
const loadRejected = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const hitKey = (h: Hit) => `${h.app.id}:${h.dm}`;
const FAMILY_ORDER = ['ruach', 'sechel', 'regesh', 'yetzer'];
const CORE = ACTIONS.filter((a) => a.id !== 'other');
const readHash = () => { const sp = new URLSearchParams(location.hash.split('?')[1] || ''); return { d: sp.get('d'), a: sp.get('a') }; };

export default function App() {
  const init = readHash();
  const [apps, setApps] = useState<AppT[]>(SNAPSHOT);
  const [live, setLive] = useState<'loading' | 'live' | 'snapshot'>('loading');
  const [rejected, setRejected] = useState<string[]>(loadRejected);
  const [sel, setSel] = useState<string | null>(init.d);
  const [act, setAct] = useState<string | null>(init.a);
  const [info, setInfo] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadLive().then((x) => { if (x && x.length) { setApps(x); setLive('live'); } else setLive('snapshot'); }); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(rejected)); setSaved(true); const t = setTimeout(() => setSaved(false), 1200); return () => clearTimeout(t); } catch { /* */ } }, [rejected]);
  useEffect(() => { const sp = new URLSearchParams(); if (sel) sp.set('d', sel); if (act) sp.set('a', act); history.replaceState(null, '', `#/${sp.toString() ? '?' + sp : ''}`); }, [sel, act]);

  const raw = useMemo(() => analyse(apps), [apps]);
  // human check: a rejected match leaves the map, and the share kept is the tool's measured precision
  const m = useMemo(() => {
    const rej = new Set(rejected);
    const r = analyse(raw.apps);
    r.rows.forEach((row) => {
      row.hits = row.hits.filter((h) => !rej.has(hitKey(h)));
      row.cells.forEach((c) => { c.apps = c.apps.filter((h) => !rej.has(hitKey(h))); });
      row.empty = row.cells.filter((c) => !c.apps.length && c.a !== 'other').length;
    });
    const total = r.rows.reduce((s, x) => s + x.hits.length, 0) || 1;
    r.rows.forEach((row) => { row.aShare = row.hits.length / total; row.gap = row.kShare - row.aShare; });
    r.holes = r.rows.filter((x) => !x.hits.length);
    r.ranked = r.rows.slice().sort((a, b) => b.gap - a.gap);
    return r;
  }, [raw, rejected]);
  const checked = rejected.length;
  const precision = raw.hits.length ? (raw.hits.length - checked) / raw.hits.length : 1;

  useEffect(() => {
    const el = document.querySelector('ai-menu') as (HTMLElement & { items?: unknown; status?: string }) | null;
    if (!el) return;
    el.items = [
      { label: 'העתקת קישור למצב הזה', onSelect: () => navigator.clipboard?.writeText(location.href) },
      { label: 'איפוס הבדיקות שלי', onSelect: () => setRejected([]) },
      { label: 'תיק העבודות', onSelect: () => open(APP_OF_APP, '_blank') },
    ];
    el.status = saved ? 'נשמר' : live === 'live' ? 'נתונים חיים' : live === 'snapshot' ? `תמונה מ-${SNAPSHOT_DATE}` : 'טוען';
  });

  const top = m.ranked[0];
  const totalCells = m.rows.length * CORE.length;
  const filled = m.rows.reduce((s, r) => s + r.cells.filter((c) => c.a !== 'other' && c.apps.length).length, 0);
  const row = sel ? m.rows.find((r) => r.d.id === sel) : null;
  const archShare = m.rows.find((r) => r.d.id === 'architecture');

  return (
    <div className="app-shell keep-mobile">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); setSel(null); setAct(null); }}><img src="/icon.svg" alt="" /><span>החורים בתיק</span></a>
          <nav className="tabs" aria-label="מצב הנתונים"><span className={`src-state s-${live}`}>{live === 'live' ? <>נתונים חיים · <span className="num">{apps.length}</span> אפליקציות</> : live === 'snapshot' ? <>תמונת מצב מ-<span className="num">{SNAPSHOT_DATE}</span> · <span className="num">{apps.length}</span> אפליקציות</> : 'טוען את התיק'}</span></nav>
          <div className="bar-end">
            <button className="icon-btn press" aria-label="איך זה עובד" title="איך זה עובד" onClick={() => setInfo(true)}><InfoIcon /></button>
            <ai-menu chat="https://claude.ai/code/session_01UBnSCMKgXaDm7dt8DD2yKe"></ai-menu>
          </div>
        </div>
      </header>

      <main className="app-main focus-aside nolli-main">
        <section className="board">
          <div className="lens">
            <p className="lens-line">
              <Rich text={`==החור הגדול: ${top.d.he}.== **${top.k}** גילויים במאגר, ו-**${top.hits.length}** ${top.hits.length === 1 ? 'אפליקציה' : 'אפליקציות'} בתיק.`} />
              {archShare && <span className="lens-sub"> <Rich text={`מנגד, **אדריכלות** תופסת **${pct(archShare.aShare)}** מהתיק, ו-**${pct(archShare.kShare)}** מהידע.`} /></span>}
            </p>
            <div className="kpis">
              <Kpi label="תחומי ידע בלי אפליקציה" value={`${m.holes.length}`} sub={m.holes.map((h) => h.d.he).join(', ') || 'אין'} tone={m.holes.length ? 'bad' : undefined} />
              <Kpi label="תאים מלאים במפה" value={`${filled}/${totalCells}`} sub={`${pct(filled / totalCells)} מהשילובים של תחום ופעולה`} />
              <Kpi label="אפליקציות שמופו" value={`${apps.length - m.unmapped.length}/${apps.length}`} sub="השאר: עירוני, אישי, AI" />
              <Kpi label="דיוק המיפוי, לפי הבדיקה שלך" value={checked ? pct(precision) : '—'} sub={checked ? `דחית ${checked} מתוך ${raw.hits.length} התאמות` : 'לחץ על תחום ובדוק את ההתאמות'} />
            </div>
          </div>

          <div className="nolli" role="grid" aria-label="מפת התיק: תחום ידע מול פעולה">
            <div className="n-head" role="row">
              <span className="n-fam" />
              <span className="n-name label">תחום ידע</span>
              {CORE.map((a) => <button key={a.id} role="columnheader" className={`n-col press ${act === a.id ? 'is-on' : ''}`} aria-pressed={act === a.id} onClick={() => setAct(act === a.id ? null : a.id)}>{a.he}</button>)}
              <span className="n-bal label">ידע מול תיק</span>
            </div>
            {FAMILY_ORDER.map((f) => {
              const list = m.rows.filter((r) => r.d.family === f);
              return (
                <div key={f} className="n-family" style={{ ['--c' as string]: list[0].d.color }}>
                  <span className="n-fam-label" style={{ gridRow: `1 / span ${list.length}` }}>{list[0].d.familyHe}</span>
                  {list.map((r) => (
                    <div key={r.d.id} role="row" className={`n-row ${sel === r.d.id ? 'is-sel' : ''} ${sel && sel !== r.d.id ? 'is-mute' : ''} ${!r.hits.length ? 'is-hole' : ''}`}>
                      <button className="n-name press" onClick={() => setSel(sel === r.d.id ? null : r.d.id)} aria-pressed={sel === r.d.id}>
                        {r.d.he} <span className="num n-count">{r.hits.length}</span>
                      </button>
                      {r.cells.filter((c) => c.a !== 'other').map((c) => (
                        <button key={c.a} role="gridcell" className={`n-cell press ${c.apps.length ? 'built' : 'void'} ${act && act !== c.a ? 'is-mute' : ''}`}
                          aria-label={`${r.d.he}, ${ACTIONS.find((x) => x.id === c.a)!.he}: ${c.apps.length} אפליקציות`}
                          title={c.apps.map((h) => h.app.n).join('\n') || 'חור'}
                          onClick={() => { setSel(r.d.id); setAct(c.a); }}>
                          {c.apps.length > 0 && <i style={{ ['--s' as string]: Math.min(1, 0.45 + c.apps.length * 0.18) }} />}
                          {c.apps.length > 1 && <span className="num">{c.apps.length}</span>}
                        </button>
                      ))}
                      <span className="n-bal" title={`ידע ${pct(r.kShare)} · תיק ${pct(r.aShare)}`}>
                        <span className="bal-k" style={{ width: `${Math.min(100, r.kShare * 400)}%` }} />
                        <span className="bal-a" style={{ width: `${Math.min(100, r.aShare * 400)}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="n-legend">
            <span><i className="lg built" /> בנוי: יש אפליקציה</span>
            <span><i className="lg void" /> חור</span>
            <span><i className="lg bal-k" /> חלק התחום בידע ({DISCS.length} גילויים)</span>
            <span><i className="lg bal-a" /> חלק התחום בתיק</span>
          </p>
        </section>

        <aside className="side">
          {row ? <DomainPanel row={row} act={act} setAct={setAct} rejected={rejected} setRejected={setRejected} /> : <Ranking m={m} pick={(d) => setSel(d)} />}
        </aside>
      </main>
      {info && <Method onClose={() => setInfo(false)} />}
    </div>
  );
}

type Analysis = ReturnType<typeof analyse>;
type Row = Analysis['rows'][number];

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'bad' }) {
  return <div className={`kpi ${tone ? 'kpi-bad' : ''}`}><p className="label">{label}</p><p className="kpi-v num">{value}</p><p className="kpi-s">{sub}</p></div>;
}

function Ranking({ m, pick }: { m: Analysis; pick: (d: string) => void }) {
  return (
    <div className="side-block">
      <p className="label">החורים, מהגדול לקטן · ידע פחות תיק</p>
      <ol className="rank">
        {m.ranked.filter((r) => r.gap > 0).map((r, i) => (
          <li key={r.d.id}>
            <button className="rank-row press" onClick={() => pick(r.d.id)}>
              <span className="num rank-n">{i + 1}</span>
              <span className="rank-name" style={{ color: r.d.color }}>{r.d.he}</span>
              <span className="rank-bar"><i style={{ width: `${Math.min(100, r.gap * 1200)}%` }} /></span>
              <span className="num rank-v">{(r.gap * 100).toFixed(1)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="kpi-s">המספר: נקודות אחוז שבהן חלק התחום בידע גדול מחלקו בתיק. לחץ על תחום כדי לראות על מה לבנות.</p>
    </div>
  );
}

function DomainPanel({ row, act, setAct, rejected, setRejected }: { row: Row; act: string | null; setAct: (a: string | null) => void; rejected: string[]; setRejected: (f: (x: string[]) => string[]) => void }) {
  const [copied, setCopied] = useState(false);
  const firstEmpty = row.cells.find((c) => c.a !== 'other' && !c.apps.length)?.a || 'diagnose';
  const action = act && act !== 'other' ? act : firstEmpty;
  const cell = row.cells.find((c) => c.a === action)!;
  const base = anchors(row.d.id);
  const prompt = promptFor(row.d, action, row.hits.map((h) => h.app));
  const rawHits = row.hits;
  return (
    <div className="panel rise" key={row.d.id}>
      <div className="side-block">
        <p className="label">{row.d.familyHe}</p>
        <h2 className="side-h">{row.d.he} <span className="en">{row.d.en}</span></h2>
        <p className="p-nums"><span className="num">{row.k}</span> גילויים במאגר · <span className="num">{row.hits.length}</span> אפליקציות בתיק · <span className="num">{row.empty}</span> פעולות ריקות</p>
        <div className="p-actions">
          {CORE.map((a) => {
            const c = row.cells.find((x) => x.a === a.id)!;
            return <button key={a.id} className={`chip press ${c.apps.length ? 'has' : 'hole'}`} aria-pressed={action === a.id} onClick={() => setAct(a.id)}>{a.he}{c.apps.length ? <span className="num"> {c.apps.length}</span> : null}</button>;
          })}
        </div>
      </div>

      <div className="side-block">
        <p className="label">{cell.apps.length ? `מה כבר יש · ${ACTIONS.find((a) => a.id === action)!.he}` : `חור · ${ACTIONS.find((a) => a.id === action)!.he}`}</p>
        {cell.apps.length ? (
          <ul className="hits">{cell.apps.map((h) => <HitRow key={hitKey(h)} h={h} reject={() => setRejected((x) => [...x, hitKey(h)])} />)}</ul>
        ) : (
          <p className="hole-line"><Rich text={`==אין בתיק אפליקציה של ${ACTIONS.find((a) => a.id === action)!.he} ב${row.d.he}.== הנה על מה לבנות אותה.`} /></p>
        )}
        {!!rawHits.length && rawHits.length !== cell.apps.length && <p className="kpi-s">בכל התחום: {rawHits.map((h) => h.app.n).slice(0, 6).join(' · ')}{rawHits.length > 6 ? ' ...' : ''}</p>}
        {rejected.some((k) => k.endsWith(`:${row.d.id}`)) && <button className="link-btn" onClick={() => setRejected((x) => x.filter((k) => !k.endsWith(`:${row.d.id}`)))}>החזרת ההתאמות שדחיתי בתחום הזה</button>}
      </div>

      <div className="side-block">
        <p className="label">שלושה גילויים לבנות עליהם</p>
        <ul className="anchors">
          {base.map((d) => (
            <li key={d.id}>
              <span className="num">{yearLabel(d.y)}</span> <strong>{d.who.join(' ו') || 'יוצר לא ידוע'}</strong>
              <span className="a-t">{d.t}</span>
              <a className="src" href={d.src.u} target="_blank" rel="noreferrer">{d.src.t}</a>
            </li>
          ))}
        </ul>
      </div>

      <div className="side-block prompt-block">
        <p className="label">פרומפט מוכן ל-Claude Code</p>
        <pre className="prompt" dir="rtl">{prompt}</pre>
        <button className="btn press dark wide" onClick={() => { navigator.clipboard?.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'הועתק' : 'העתקת הפרומפט'}</button>
      </div>
    </div>
  );
}

function HitRow({ h, reject }: { h: Hit; reject: () => void }) {
  return (
    <li className="hit">
      <div>
        {h.app.u ? <a href={h.app.u} target="_blank" rel="noreferrer" className="hit-n">{h.app.n}</a> : <span className="hit-n">{h.app.n}</span>}
        <p className="hit-why">נמצא דרך <mark className="insight">{h.word}</mark> ב{h.field}</p>
      </div>
      <button className="link-btn" onClick={reject} title="ההתאמה שגויה: להוציא מהמפה">לא שייך</button>
    </li>
  );
}

function Method({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="איך זה עובד" onClose={onClose}>
      <h3>למה זה חשוב</h3>
      <p>תיק של <strong>139</strong> אפליקציות נבנה לפי הצורך של היום. <mark className="insight">מה שלא בנינו, לא רואים.</mark> הכלי שם את התיק מול מפה של כל הידע, ומראה את הלבן.</p>
      <h3>על מה הוא נשען</h3>
      <p>שני מקורות חיים: <strong>תיק העבודות</strong> (טבלת <span className="num">aoa_apps</span>, נקרא בכל פתיחה), ו<strong>עולם נעלם ומציאות מצויה</strong>: <span className="num">424</span> גילויים מאומתים ב-<span className="num">14</span> תחומים, בארבע משפחות.</p>
      <p>הגשר ביניהם הוא <strong>מילון גלוי</strong>: לכל תחום ידע, המילים שמעידות שאפליקציה נוגעת בו. כל התאמה מראה את המילה ואת השדה שבו נמצאה.</p>
      <h3>איך הכלי מודד את האמינות של עצמו</h3>
      <p>ליד כל התאמה יש <strong>"לא שייך"</strong>. כל דחייה יוצאת מהמפה, והכלי מציג את <strong>דיוק המיפוי</strong>: כמה מההתאמות שלו עמדו בבדיקה שלך. הבדיקות נשמרות במכשיר.</p>
      <h3>החישוב</h3>
      <p><strong>חור</strong> = חלק התחום בידע פחות חלקו בתיק, בנקודות אחוז. תא לבן במפה = אין אפליקציה של הפעולה הזאת בתחום הזה.</p>
      <h3>מגבלות</h3>
      <p>מילון מוצא מילים, לא כוונה. אפליקציה עירונית, אישית או של AI לא תופיע, כי אלה אינם תחומי ידע במאגר הגילויים. מאגר הגילויים עצמו הוא בחירה, ולא כל הידע.</p>
      <h3>איך משתמשים</h3>
      <p>לוחצים על תחום או על תא. בצד: מה כבר יש, שלושה גילויים לבנות עליהם, ופרומפט מוכן להעתקה. כותרות העמודות מבליטות פעולה אחת.</p>
      <p className="src">ההשראה: <strong>מפת רומא של ג'מבטיסטה נולי</strong> Giambattista Nolli, 1748. הבנוי בשחור, והמרחב הפתוח בלבן.</p>
    </Dialog>
  );
}

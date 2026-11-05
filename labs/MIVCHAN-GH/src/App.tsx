import { useEffect, useMemo, useState } from 'react';
import { DOMAIN, ROWS, UNTESTED, amirotLink, count, longest, olamLink, yearLabel, type Row } from './engine';
import { VERDICT, type Verdict } from './data/tests';
import { Rich } from './Rich';
import { Dialog, InfoIcon } from './Dialog';

type View = 'tests' | 'wait';
type Filter = Verdict | 'untested' | null;
const ORDER: Verdict[] = ['confirmed', 'cond', 'literal', 'refuted'];
const readHash = () => {
  const [p, q = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const sp = new URLSearchParams(q);
  return { view: (p === 'wait' ? 'wait' : 'tests') as View, t: sp.get('t'), f: (sp.get('f') as Filter) || null };
};
const writeHash = (view: View, t: string | null, f: Filter) => {
  const sp = new URLSearchParams(); if (t) sp.set('t', t); if (f) sp.set('f', f);
  const h = `#/${view === 'wait' ? 'wait' : ''}${sp.toString() ? '?' + sp : ''}`;
  history.replaceState(null, '', h);
};

export default function App() {
  const init = readHash();
  const [view, setView] = useState<View>(init.view);
  const [sel, setSel] = useState<string>(init.t && ROWS.some((r) => r.id === init.t) ? init.t : ROWS[0].id);
  const [filter, setFilter] = useState<Filter>(init.f);
  const [info, setInfo] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => writeHash(view, sel, filter), [view, sel, filter]);

  const rows = useMemo(() => (filter && filter !== 'untested' ? ROWS.filter((r) => r.verdict === filter) : ROWS), [filter]);
  const row = ROWS.find((r) => r.id === sel)!;

  useEffect(() => {
    const el = document.querySelector('ai-menu') as (HTMLElement & { items?: unknown; status?: string }) | null;
    if (!el) return;
    el.items = [{ label: 'העתקת קישור למבחן הזה', onSelect: () => navigator.clipboard?.writeText(location.href) }];
    el.status = `${ROWS.length} מבחנים`;
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (info || view !== 'tests' || filter === 'untested') return;
      const i = rows.findIndex((r) => r.id === sel);
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); setSel(rows[Math.min(rows.length - 1, i + 1)].id); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); setSel(rows[Math.max(0, i - 1)].id); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  const pickFilter = (f: Filter) => {
    const next = filter === f ? null : f;
    setFilter(next);
    if (next && next !== 'untested') { const first = ROWS.find((r) => r.verdict === next); if (first && !ROWS.find((r) => r.id === sel && r.verdict === next)) setSel(first.id); }
  };
  const L = longest();

  return (
    <div className="app-shell keep-mobile">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); setView('tests'); setFilter(null); }}><img src="/icon.svg" alt="" /><span>אמירה במבחן המדע</span></a>
          <nav className="tabs" aria-label="ניווט">
            <button className="tab" aria-current={view === 'tests' ? 'page' : undefined} onClick={() => setView('tests')}>המבחנים</button>
            <button className="tab" aria-current={view === 'wait' ? 'page' : undefined} onClick={() => setView('wait')}>כמה זמן חיכו</button>
          </nav>
          <div className="bar-end">
            <button className="icon-btn press" aria-label="איך זה עובד" title="איך זה עובד" onClick={() => setInfo(true)}><InfoIcon /></button>
            <ai-menu chat="https://claude.ai/code/session_01UBnSCMKgXaDm7dt8DD2yKe"></ai-menu>
          </div>
        </div>
      </header>

      <main className="app-main focus-aside lab">
        <section className="board">
          <div className="lens">
            <p className="lens-line">
              <strong className="num">{ROWS.length}</strong> אמירות מ<strong>"אמירות"</strong> מול גילויים מתועדים מ<strong>"עולם נעלם"</strong>.{' '}
              <mark className="insight"><span className="num">{count('confirmed') + count('cond') + count('literal')}</span> עומדות במבחן, <span className="num">{count('cond')}</span> מהן רק בתנאי.</mark>
            </p>
            <div className="legend-chips" role="group" aria-label="סינון לפי פסק">
              {ORDER.map((v) => (
                <button key={v} className={`chip press vc v-${v}`} aria-pressed={filter === v} onClick={() => pickFilter(v)}>
                  <span className={`stamp-mini v-${v}`} />{VERDICT[v].he} <span className="num">{count(v)}</span>
                </button>
              ))}
              <button className="chip press vc v-untested" aria-pressed={filter === 'untested'} onClick={() => pickFilter('untested')}>
                <span className="stamp-mini v-untested" />לא נבדק <span className="num">{UNTESTED.length}</span>
              </button>
              <button className="chip press all" aria-pressed={!filter} onClick={() => setFilter(null)}>הכול</button>
            </div>
          </div>

          {view === 'tests' ? (
            filter === 'untested' ? <Untested /> : (
              <ol className="rows" aria-label="המבחנים">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button className={`row press ${r.id === sel ? 'is-sel' : ''}`} aria-pressed={r.id === sel} onClick={() => { setSel(r.id); setSheet(true); }}>
                      <span className="num row-n">{String(ROWS.indexOf(r) + 1).padStart(2, '0')}</span>
                      <span className="row-say">{r.s.he}</span>
                      <span className="row-arrow" aria-hidden>
                        <svg viewBox="0 0 40 10" width="40" height="10"><path d="M40 5H4M8 1L4 5l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                      </span>
                      <span className="row-disc">
                        <span className="num">{yearLabel(r.d[0].y)}</span> {r.d[0].who.map((w) => w.he).join(' ו')}
                        {r.d.length > 1 && <span className="dim"> ועוד {r.d.length - 1}</span>}
                      </span>
                      <span className={`stamp v-${r.verdict}`}>{VERDICT[r.verdict].he}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <WaitChart select={(id) => { setSel(id); setSheet(true); }} sel={sel} />
          )}
        </section>

        <aside className={`side ${sheet ? 'is-open' : ''}`}>
          <button className="icon-btn press sheet-x" aria-label="סגירת הפרטים" onClick={() => setSheet(false)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          {filter === 'untested' ? <UntestedSide /> : <Detail r={row} />}
          {view === 'wait' && L && filter !== 'untested' && (
            <div className="side-block tone tone-insight">
              <h4>ההמתנה הארוכה ביותר</h4>
              <p><Rich text={`"${L.s.he}" חיכתה **${L.wait!.toLocaleString('he-IL')}** שנה למבחן של **${L.d[0].who[0]?.he}**.`} /></p>
            </div>
          )}
        </aside>
      </main>
      {info && <Method onClose={() => setInfo(false)} />}
    </div>
  );
}

function Detail({ r }: { r: Row }) {
  return (
    <article className="detail rise" key={r.id}>
      <div className="d-say">
        <p className="label">האמירה · {r.ideaQ}</p>
        <blockquote className="say-big">"{r.s.he}"</blockquote>
        {r.s.orig && <p className="orig" lang="und">{r.s.orig}</p>}
        <p className="src">{r.s.src}{r.s.year !== null && <> · <span className="num">{yearLabel(r.s.year)}</span></>} · <a href={amirotLink(r.s)} target="_blank" rel="noreferrer">באמירות</a></p>
        {r.c && <p className="counter"><span className="label">ומנגד</span> "{r.c.he}" <span className="src">{r.c.src}</span></p>}
      </div>

      <div className={`d-verdict v-${r.verdict}`}>
        <span className={`stamp big v-${r.verdict}`}>{VERDICT[r.verdict].he}</span>
        <div>
          <p className="d-line"><Rich text={r.line} /></p>
          <p className="d-scope">תחום הפסק: <strong>{r.scope}</strong></p>
        </div>
      </div>

      <div className="layer layer-read">
        <p className="layer-h"><span className="tag tag-read">פרשנות</span> איך הגילוי עונה לאמירה</p>
        <p className="read"><Rich text={r.why} /></p>
        {r.rule && <p className="rule"><span className="label">כלל ההכרעה</span> {r.rule}</p>}
      </div>
      <div className="layer layer-fact">
        <p className="layer-h"><span className="tag tag-fact">עובדה</span> מה המקור אומר</p>
        {r.d.map((d) => (
          <div key={d.id} className="disc">
            <p className="disc-h">
              <span className="num">{yearLabel(d.y)}</span>{' '}
              <strong>{d.who.map((w) => w.he).join(' ו')}</strong>{' '}
              <span className="en">{d.who.map((w) => w.en).join(' & ')}</span>
              <span className="dm" style={{ color: DOMAIN.get(d.dm)?.color }}> · {DOMAIN.get(d.dm)?.he}</span>
            </p>
            <p className="disc-t">{d.t}</p>
            <p className="disc-c"><Rich text={d.nov || d.con} /></p>
            {d.q && <p className="disc-q">"{d.q}"</p>}
            <p className="src"><a href={d.src.u} target="_blank" rel="noreferrer">{d.src.t}</a> · <a href={olamLink(d)} target="_blank" rel="noreferrer">בעולם נעלם</a></p>
          </div>
        ))}
      </div>

    </article>
  );
}

/** Each saying as a line from the year it was first written to the year science answered it. */
function WaitChart({ sel, select }: { sel: string; select: (id: string) => void }) {
  const dated = ROWS.filter((r) => r.wait !== null).sort((a, b) => b.wait! - a.wait!);
  const folk = ROWS.filter((r) => r.wait === null);
  const min = -1800, max = 2030;
  const X = (y: number) => ((y - min) / (max - min)) * 100;
  const ticks = [-1500, -1000, -500, 0, 500, 1000, 1500, 2000];
  return (
    <div className="wait">
      <div className="axis-row">
        <span />
        <div className="axis">{ticks.map((t) => <span key={t} dir="rtl" style={{ left: `${X(t)}%` }} className="num">{yearLabel(t)}</span>)}</div>
        <span />
      </div>
      <div className="wait-list">
        {dated.map((r) => (
          <button key={r.id} className={`wait-row press ${r.id === sel ? 'is-sel' : ''}`} onClick={() => select(r.id)} aria-pressed={r.id === sel}>
            <span className="w-say">{r.s.he}</span>
            <span className="w-track">
              {ticks.map((t) => <i key={t} className="grid" style={{ left: `${X(t)}%` }} />)}
              <span className={`w-bar v-${r.verdict} ${r.wait! < 0 ? 'ahead' : ''}`} style={{ left: `${X(Math.min(r.s.year!, r.d[0].y))}%`, width: `${Math.abs(X(r.d[0].y) - X(r.s.year!))}%` }} />
              <span className="w-dot say" style={{ left: `${X(r.s.year!)}%` }} />
              <span className={`w-dot disc v-${r.verdict}`} style={{ left: `${X(r.d[0].y)}%` }} />
            </span>
            <span className={`num w-n ${r.wait! < 0 ? 'ahead' : ''}`} title={r.wait! < 0 ? 'הגילוי קדם לתיעוד הראשון של האמירה' : 'שנות המתנה'}>{r.wait! < 0 ? `קדם ${-r.wait!}` : r.wait!.toLocaleString('he-IL')}</span>
          </button>
        ))}
        <p className="label folk-h">פתגמים עממיים בלי תאריך מתועד · רק שנת המבחן</p>
        {folk.map((r) => (
          <button key={r.id} className={`wait-row press folk ${r.id === sel ? 'is-sel' : ''}`} onClick={() => select(r.id)} aria-pressed={r.id === sel}>
            <span className="w-say">{r.s.he}</span>
            <span className="w-track">
              {ticks.map((t) => <i key={t} className="grid" style={{ left: `${X(t)}%` }} />)}
              <span className={`w-dot disc v-${r.verdict}`} style={{ left: `${X(r.d[0].y)}%` }} />
            </span>
            <span className="num w-n">?</span>
          </button>
        ))}
      </div>
      <p className="wait-legend"><span className="w-dot say inline" /> השנה שבה האמירה נכתבה לראשונה <span className="w-dot disc v-confirmed inline" /> שנת הגילוי שבחן אותה, בצבע הפסק. המספר: שנות המתנה. "קדם": הגילוי נעשה לפני התיעוד הראשון של האמירה.</p>
    </div>
  );
}

function Untested() {
  return (
    <div className="untested">
      <p className="u-lead"><Rich text={`**${UNTESTED.length}** מחלוקות באמירות עוד לא פגשו גילוי במאגר. ==זה לא כישלון של הפתגם, זה חור במאגר הגילויים.==`} /></p>
      <ul className="u-grid">
        {UNTESTED.map((i) => (
          <li key={i.id} className="u-card">
            <p className="label">{i.chip}</p>
            <p className="u-q">{i.q}</p>
            <p className="u-sides"><span>{i.a}</span><span className="dim">מול</span><span>{i.b}</span></p>
            <a className="src" href={`https://amirot-gh.vercel.app/#/daf?i=${i.id}`} target="_blank" rel="noreferrer">לדף באמירות</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
function UntestedSide() {
  return (
    <div className="side-block">
      <p className="label">למה מסמנים חורים</p>
      <p className="read">מבחן נשען רק על גילוי מאומת עם מקור. כשאין כזה במאגר, לא ממציאים קשר.</p>
      <p className="read">כל חור הוא הצעה: גילוי שכדאי להוסיף ל<a href="https://olam-gh.vercel.app" target="_blank" rel="noreferrer">עולם נעלם ומציאות מצויה</a>, כדי שהפתגם ייבחן.</p>
    </div>
  );
}

function Method({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="איך זה עובד" onClose={onClose}>
      <h3>למה זה חשוב</h3>
      <p>פתגם הוא <strong>השערה</strong> שעברה בעל פה מאות שנים. <mark className="insight">מדע הוא הדרך לבדוק אותה.</mark> כאן הם נפגשים.</p>
      <h3>מה נבדק</h3>
      <p>כל מבחן מצמיד אמירה מהמאגר של <strong>אמירות</strong> (<span className="num">252</span> פתגמים מ-<span className="num">38</span> תרבויות) לגילוי <strong>מאומת</strong> מ<strong>עולם נעלם ומציאות מצויה</strong> (<span className="num">424</span> גילויים עם ציטוט ממקור).</p>
      <h3>שתי שכבות, בשני צבעים</h3>
      <p><span className="tag tag-fact">עובדה</span> הגילוי, השנה והציטוט, כמו שהם במקור.</p>
      <p><span className="tag tag-read">פרשנות</span> הקשר בין האמירה לגילוי, והפסק. זו קריאה, לא ניסוי. הצבעים לקוחים משפת הביטחון של עולם נעלם.</p>
      <h3>ארבעה פסקים</h3>
      {ORDER.map((v) => <p key={v}><span className={`stamp v-${v}`}>{VERDICT[v].he}</span> {VERDICT[v].why}</p>)}
      <h3>מגבלות</h3>
      <p>הפסק תקף רק ב<strong>תחום</strong> שכתוב לידו. גילוי אחד לא סוגר שאלה, והוא נבחר מתוך מאגר מוגבל. כש"אין גילוי", המבחן לא נעשה.</p>
      <h3>איך משתמשים</h3>
      <p>לוחצים על שורה, או חיצים במקלדת. כפתורי הפסק הם גם המקרא, והם מסננים. "כמה זמן חיכו" מראה כמה שנים עברו מהפתגם ועד המבחן.</p>
      <p className="src">ההשראה: יומני המעבדה של <strong>מייקל פאראדיי</strong> Michael Faraday, שבהם כל ניסוי קיבל פסקה ממוספרת.</p>
    </Dialog>
  );
}

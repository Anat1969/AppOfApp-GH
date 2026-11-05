import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONF, DOMAINS, STATE, century, domainOf, insight, makeRound, measure, stateOf, yearLabel, type Answer, type Conf, type Question, type State } from './engine';
import { Rich } from './Rich';
import { Dialog, InfoIcon } from './Dialog';

const KEY = 'omek.v1';
const load = (): Answer[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const OLAM = 'https://olam-gh.vercel.app';
type View = 'measure' | 'map';
const viewFromHash = (): View => (location.hash === '#/map' ? 'map' : 'measure');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const FAMILY_ORDER = ['ruach', 'sechel', 'regesh', 'yetzer'];

export default function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [answers, setAnswers] = useState<Answer[]>(load);
  const [only, setOnly] = useState<string | undefined>();
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState<Answer | null>(null);
  const [info, setInfo] = useState(false);
  const [saved, setSaved] = useState(false);

  const asked = useMemo(() => new Set(answers.map((a) => a.q)), [answers]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo<Question[]>(() => makeRound(seed, asked, only), [seed, only]);
  const q = round[i];
  const m = useMemo(() => measure(answers), [answers]);
  const [start, setStart] = useState(() => Date.now());
  const roundAns = answers.filter((a) => a.ts >= start && round.some((r) => r.id === a.q));

  useEffect(() => { const f = () => setView(viewFromHash()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(answers)); setSaved(true); const t = setTimeout(() => setSaved(false), 1400); return () => clearTimeout(t); } catch { /* private mode */ }
  }, [answers]);

  const go = (v: View) => { location.hash = v === 'map' ? '#/map' : '#/'; setView(v); };
  const newRound = useCallback((dm?: string) => { setStart(Date.now()); setOnly(dm); setSeed((s) => s + 7919); setI(0); setPick(null); setDone(null); go('measure'); }, []);

  // A&I logo: development and system actions only
  useEffect(() => {
    const el = document.querySelector('ai-menu') as (HTMLElement & { items?: unknown; status?: string }) | null;
    if (!el) return;
    el.items = [
      { label: 'סבב חדש', onSelect: () => newRound() },
      { label: 'איפוס כל המדידות', onSelect: () => { if (confirm('למחוק את כל התשובות שנשמרו במכשיר הזה?')) { setAnswers([]); newRound(); } } },
    ];
    el.status = saved ? 'נשמר' : `${answers.length} תשובות במכשיר`;
  });

  const answer = (c: Conf) => {
    if (pick === null || !q) return;
    const a: Answer = { q: q.id, disc: q.disc.id, dm: q.disc.dm, type: q.type, correct: pick === q.answer, conf: c, ts: Date.now() };
    setAnswers((x) => [...x, a]);
    setDone(a);
  };
  const next = () => { if (i + 1 >= round.length) { go('map'); setI(0); setStart(Date.now()); setSeed((s) => s + 31); } else setI(i + 1); setPick(null); setDone(null); };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (view !== 'measure' || info) return;
      if (done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
      else if (!done && ['1', '2', '3', '4'].includes(e.key) && pick === null) setPick(+e.key - 1);
      else if (!done && pick !== null && ['ב', 'b'].includes(e.key)) answer(3);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); go('measure'); }}>
            <img src="/icon.svg" alt="" /><span>מד עומק ידע</span>
          </a>
          <nav className="tabs" aria-label="ניווט">
            <button className="tab" aria-current={view === 'measure' ? 'page' : undefined} onClick={() => go('measure')}>מדידה</button>
            <button className="tab" aria-current={view === 'map' ? 'page' : undefined} onClick={() => go('map')}>מפת העומק <span className="num tab-n">{answers.length}</span></button>
          </nav>
          <div className="bar-end">
            <button className="icon-btn press" aria-label="השיטה והאמינות" title="השיטה והאמינות" onClick={() => setInfo(true)}><InfoIcon /></button>
            <ai-menu chat="https://claude.ai/code/session_01UBnSCMKgXaDm7dt8DD2yKe"></ai-menu>
          </div>
        </div>
      </header>

      {view === 'measure' ? (
        <main className="app-main focus-aside measure">
          <section className="qcard" aria-live="polite">
            {q ? <QuestionCard q={q} i={i} total={round.length} pick={pick} setPick={setPick} done={done} answer={answer} next={next} only={only} /> : <p>אין עוד שאלות בתחום הזה. <button className="btn press" onClick={() => newRound()}>סבב כללי</button></p>}
          </section>
          <aside className="side">
            <Sounding round={round} ans={roundAns} i={i} />
            <div className="side-block">
              <p className="label">מדידה ממוקדת</p>
              <div className="dm-chips">
                {DOMAINS.map((d) => (
                  <button key={d.id} className="chip press" aria-pressed={only === d.id} style={{ ['--c' as string]: d.color }} onClick={() => newRound(d.id)}>{d.he}</button>
                ))}
                <button className="chip press all" aria-pressed={!only} onClick={() => newRound()}>כל התחומים</button>
              </div>
            </div>
            <Legend />
          </aside>
        </main>
      ) : (
        <DepthMap m={m} answers={answers} newRound={newRound} />
      )}

      {info && <Method onClose={() => setInfo(false)} />}
    </div>
  );
}

function QuestionCard({ q, i, total, pick, setPick, done, answer, next, only }: {
  q: Question; i: number; total: number; pick: number | null; setPick: (n: number) => void; done: Answer | null; answer: (c: Conf) => void; next: () => void; only?: string;
}) {
  const d = domainOf(q.disc.dm);
  const st = done ? stateOf(done) : null;
  return (
    <div className="q rise" key={q.id}>
      <div className="q-meta">
        <span className="label">שאלה <span className="num">{i + 1}</span> מתוך <span className="num">{total}</span>{only ? ` · ${d.he}` : ''}</span>
        <span className="dm-tag" style={{ ['--c' as string]: d.color }}>{d.familyHe} · {d.he}</span>
      </div>
      <h1 className="q-title">{q.disc.t}</h1>
      <p className="q-ask">{q.prompt}</p>
      <div className="opts" role="radiogroup" aria-label="תשובות">
        {q.options.map((o, k) => {
          const cls = done ? (k === q.answer ? 'is-right' : k === pick ? 'is-wrong' : 'is-dim') : '';
          return (
            <button key={o} role="radio" aria-checked={pick === k} disabled={!!done} className={`opt press ${cls}`} aria-pressed={!done && pick === k} onClick={() => setPick(k)}>
              <span className="num opt-k">{k + 1}</span><span>{o}</span>
            </button>
          );
        })}
      </div>

      {!done && (
        <div className={`conf ${pick === null ? 'is-wait' : ''}`}>
          <p className="label">{pick === null ? 'בחר תשובה, ואז כמה אתה בטוח בה' : 'כמה אתה בטוח?'}</p>
          <div className="conf-row">
            {([1, 2, 3] as Conf[]).map((c) => (
              <button key={c} className={`conf-btn press c${c}`} disabled={pick === null} onClick={() => answer(c)}>
                <strong>{CONF[c].he}</strong>
                <span className="mono">{CONF[c].hint}</span>
                <span className="mono score">+{CONF[c].right} / {CONF[c].wrong}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {done && st && (
        <div className={`verdict rise st-${st}`}>
          <div className="v-head">
            <span className={`st-dot st-${st}`} />
            <strong>{STATE[st].he}</strong>
            <span className="v-why">{STATE[st].why}</span>
            <span className="num v-pts">{done.correct ? `+${CONF[done.conf].right}` : CONF[done.conf].wrong}</span>
          </div>
          <div className="fact">
            <p className="fact-line">
              <strong>{q.disc.who.map((w) => w.he).join(' ו') || 'יוצר לא ידוע'}</strong>
              {q.disc.who[0] && <span className="en"> {q.disc.who.map((w) => w.en).join(' & ')}</span>}
              {' · '}<span className="num">{yearLabel(q.disc.y)}</span> <span className="dim">({century(q.disc.y)})</span>
              {q.disc.city && <> · {q.disc.city.he} <span className="en">{q.disc.city.en}</span></>}
            </p>
            <p className="fact-nov"><span className="label">החידוש</span> <Rich text={q.disc.nov || q.disc.con} /></p>
            {q.disc.q && <p className="fact-q"><span className="tag-doc">מתועד</span> "{q.disc.q}"</p>}
            <p className="src">מקור: <a href={q.disc.src.u} target="_blank" rel="noreferrer">{q.disc.src.t}</a> · דרך <a href={`${OLAM}/#/search?q=${encodeURIComponent(q.disc.t.split(':')[0])}`} target="_blank" rel="noreferrer">עולם נעלם ומציאות מצויה</a></p>
          </div>
          <button className="btn press next" onClick={next}>{i + 1 >= total ? 'למפת העומק' : 'השאלה הבאה'} <span className="mono dim">Enter</span></button>
        </div>
      )}
    </div>
  );
}

/** The echo sounder: one line per question in the round, dropping to the depth the answer reached. */
function Sounding({ round, ans, i }: { round: Question[]; ans: Answer[]; i: number }) {
  const W = 300, H = 120, step = W / Math.max(round.length, 1);
  const depth: Record<State, number> = { know: 1, partly: 0.62, illusion: 0.18, unknown: 0.06 };
  return (
    <div className="side-block">
      <p className="label">הסבב הזה · קו העומק</p>
      <svg className="sounding" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="עומק התשובות בסבב">
        <defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EAF2F8" /><stop offset="1" stopColor="#0B3C5D" /></linearGradient></defs>
        <rect width={W} height={H} fill="url(#sea)" opacity=".18" />
        {[0.25, 0.5, 0.75].map((y) => <line key={y} x1="0" x2={W} y1={y * H} y2={y * H} className="contour" />)}
        {round.map((r, k) => {
          const a = ans.find((x) => x.q === r.id);
          const x = W - (k + 0.5) * step;
          const st = a ? stateOf(a) : null;
          const y = st ? depth[st] * (H - 10) + 5 : 4;
          return (
            <g key={r.id}>
              <line x1={x} x2={x} y1={0} y2={y} className={`ping ${st ? `st-${st}` : ''} ${k === i ? 'is-now' : ''}`} />
              {st && <rect x={x - 4} y={y - 4} width="8" height="8" className={`st-fill st-${st}`} />}
            </g>
          );
        })}
      </svg>
      <div className="sound-count">
        {(Object.keys(STATE) as State[]).map((s) => <span key={s}><span className={`st-dot st-${s}`} /> <span className="num">{ans.filter((a) => stateOf(a) === s).length}</span></span>)}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="side-block legend">
      <p className="label">מקרא · ארבעה עומקים</p>
      {(Object.keys(STATE) as State[]).map((s) => (
        <p key={s} className="lg-row"><span className={`st-dot st-${s}`} /><strong>{STATE[s].he}</strong><span className="dim">{STATE[s].why}</span></p>
      ))}
    </div>
  );
}

function DepthMap({ m, answers, newRound }: { m: ReturnType<typeof measure>; answers: Answer[]; newRound: (dm?: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const fams = FAMILY_ORDER.map((f) => ({ f, list: m.byDomain.filter((x) => x.d.family === f) }));
  const selRow = sel ? m.byDomain.find((x) => x.d.id === sel)! : null;
  const selAns = sel ? answers.filter((a) => a.dm === sel).slice(-8).reverse() : [];
  return (
    <main className="app-main focus-aside map">
      <section className="map-main">
        <div className="lens">
          <p className="lens-insight"><Rich text={insight(m)} /></p>
          <div className="kpis">
            <Kpi label="תשובות" value={`${m.n}`} sub={m.n ? `צדקת ב-${pct(m.k / m.n)}` : 'עוד לא נמדד'} />
            <Kpi label="טווח האמת, 95%" value={m.n ? `${pct(m.ci[0])}–${pct(m.ci[1])}` : '—'} sub="כמה מעט עשר שאלות אומרות" />
            <Kpi label="ביטחון מול דיוק" value={m.n ? `${m.over > 0 ? '+' : ''}${Math.round(m.over * 100)}` : '—'} sub={m.over > 0.05 ? 'בטוח יותר מצודק' : m.over < -0.05 ? 'צודק יותר מבטוח' : 'מכויל'} tone={m.over > 0.15 ? 'bad' : undefined} />
            <Kpi label="ציון ברייר" value={m.n ? m.brier.toFixed(2) : '—'} sub="0 מושלם · 0.25 ניחוש" />
            <Kpi label="ניקוד ביטחון" value={m.n ? `${m.cbm}` : '—'} sub={`מתוך ${m.maxCbm} אפשריים`} />
          </div>
        </div>
        <div className="chart" role="img" aria-label="מפת העומק לפי תחומים">
          {fams.map(({ f, list }) => (
            <div key={f} className="fam" style={{ ['--c' as string]: list[0]?.d.color }}>
              <p className="fam-h">{list[0]?.d.familyHe}</p>
              <div className="cells">
                {list.map((x) => (
                  <button key={x.d.id} className={`cell press ${sel === x.d.id ? 'is-sel' : ''} ${sel && sel !== x.d.id ? 'is-mute' : ''}`} onClick={() => setSel(sel === x.d.id ? null : x.d.id)}
                    style={{ ['--depth' as string]: x.depth ?? 0 }} data-empty={!x.n} data-deep={(x.depth ?? 0) > 0.3} aria-pressed={sel === x.d.id}>
                    <span className="cell-water" />
                    {x.s.illusion > 0 && <span className="cell-shoal" style={{ height: `${Math.max(14, x.illusion * 100)}%` }} />}
                    <span className="cell-name">{x.d.he}</span>
                    <span className="cell-n num">{x.n ? pct(x.depth!) : 'לא נמדד'}</span>
                    {x.n > 0 && <span className="cell-bar">{(Object.keys(STATE) as State[]).map((s) => x.s[s] ? <i key={s} className={`st-fill st-${s}`} style={{ flex: x.s[s] }} /> : null)}</span>}
                  </button>
                ))}
                {list.length < 4 && <FamilyTile list={list} />}
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="side">
        {selRow ? (
          <div className="side-block rise" key={selRow.d.id}>
            <p className="label">{selRow.d.familyHe}</p>
            <h2 className="side-h">{selRow.d.he} <span className="en">{selRow.d.en}</span></h2>
            <p className="dim">{selRow.n ? <>נמדד ב-<span className="num">{selRow.n}</span> שאלות. עומק <span className="num">{pct(selRow.depth!)}</span>.</> : 'עוד לא נשאלת בתחום הזה.'}</p>
            <ul className="ans-list">
              {selAns.map((a) => { const s = stateOf(a); return <li key={a.ts}><span className={`st-dot st-${s}`} /> {a.disc.replace(/^d-(bce)?\d+-/, '').replace(/-/g, ' ')} <span className="dim">· {STATE[s].he}</span></li>; })}
            </ul>
            <button className="btn press dark" onClick={() => newRound(selRow.d.id)}>עשר שאלות ב{selRow.d.he}</button>
          </div>
        ) : (
          <Calibration m={m} />
        )}
        <Legend />
        <div className="side-block">
          <button className="btn press dark wide" onClick={() => newRound()}>סבב חדש: שאלה מכל תחום</button>
        </div>
      </aside>
    </main>
  );
}

function FamilyTile({ list }: { list: ReturnType<typeof measure>['byDomain'] }) {
  const n = list.reduce((a, x) => a + x.n, 0);
  const measured = list.filter((x) => x.n).length;
  const d = n ? list.reduce((a, x) => a + (x.depth ?? 0) * x.n, 0) / n : null;
  return (
    <div className="fam-tile">
      <p className="label">המשפחה כולה</p>
      <p className="num fam-v">{d === null ? '—' : pct(d)}</p>
      <p className="kpi-s">נמדדו <span className="num">{measured}</span> מתוך <span className="num">{list.length}</span> תחומים</p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'bad' }) {
  return <div className={`kpi ${tone ? 'kpi-bad' : ''}`}><p className="label">{label}</p><p className="kpi-v num">{value}</p><p className="kpi-s">{sub}</p></div>;
}

/** Calibration: for each confidence level, the stated chance against the share that was right. On the diagonal = calibrated. */
function Calibration({ m }: { m: ReturnType<typeof measure> }) {
  const S = 220, P = 22, T = 34;
  const X = (p: number) => P + p * (S - 2 * P), Y = (p: number) => S - P - p * (S - P - T);
  return (
    <div className="side-block">
      <p className="label">כיול · האם הביטחון שלך אומר משהו</p>
      <svg viewBox={`0 0 ${S} ${S}`} className="calib" role="img" aria-label="גרף כיול">
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} className="diag" />
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(0)} className="axis" />
        <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(1)} className="axis" />
        {m.byConf.map((g) => g.n ? (
          <g key={g.c}>
            <line x1={X(CONF[g.c].p)} y1={Y(CONF[g.c].p)} x2={X(CONF[g.c].p)} y2={Y(g.k / g.n)} className={g.k / g.n < CONF[g.c].p ? 'gap bad' : 'gap'} />
            <rect x={X(CONF[g.c].p) - 5 - Math.min(6, g.n)} y={Y(g.k / g.n) - 5 - Math.min(6, g.n)} width={10 + 2 * Math.min(6, g.n)} height={10 + 2 * Math.min(6, g.n)} className={`pt c${g.c}`} />
            <text x={X(CONF[g.c].p)} y={Y(g.k / g.n) - 10 - Math.min(6, g.n)} textAnchor="middle" className="pt-t" direction="rtl">{CONF[g.c].he} {pct(g.k / g.n)}</text>
          </g>
        ) : null)}
      </svg>
      <p className="calib-ax"><span dir="rtl">↑ כמה צדקת</span><span dir="rtl">הביטחון שסימנת →</span></p>
      <p className="kpi-s">ריבוע מתחת לאלכסון: היית בטוח יותר ממה שצדקת. גודל הריבוע לפי מספר התשובות.</p>
    </div>
  );
}

function Method({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="השיטה והאמינות" onClose={onClose}>
      <h3>למה זה חשוב</h3>
      <p><strong>לא לדעת</strong> זה לא מסוכן. <mark className="insight">לחשוב שיודעים</mark> זה מסוכן: על זה בונים החלטה.</p>
      <h3>על מה הכלי נשען</h3>
      <p><strong>ניקוד לפי ביטחון</strong> (Certainty-Based Marking) של <strong>טוני גרדנר-מדווין</strong> Tony Gardner-Medwin, אוניברסיטת לונדון UCL. שלוש רמות: מנחש <span className="num">+1/0</span>, חושב <span className="num">+2/−2</span>, בטוח <span className="num">+3/−6</span>. הניקוד משתלם רק כשהביטחון אמיתי.</p>
      <p><strong>ציון ברייר</strong> Brier score (גלן ברייר Glenn Brier, 1950): ממוצע ריבועי ההפרש בין הביטחון לתוצאה. <span className="num">0</span> מושלם, <span className="num">0.25</span> הוא ניחוש עיוור.</p>
      <p><strong>רווח בר־סמך של וילסון</strong> Wilson score interval, ברמת <span className="num">95%</span>: כמה התוצאה יכולה לזוז רק בגלל מספר השאלות הקטן.</p>
      <h3>איך הכלי מודד את האמינות של עצמו</h3>
      <p>כל שאלה נבנית בקוד מגילוי <strong>מאומת</strong> במאגר <strong>עולם נעלם ומציאות מצויה</strong>: <span className="num">424</span> גילויים ב-<span className="num">14</span> תחומים, עם ציטוט ממקור. התשובה הנכונה היא שדה במאגר, לא ניסוח של מודל.</p>
      <p>המסיחים נלקחים מאותו תחום, כדי שהשאלה תבדוק ידיעה ולא סילוק של תשובות מופרכות.</p>
      <h3>מגבלות</h3>
      <p>שאלה אמריקאית בודקת <strong>זיהוי</strong>, לא היזכרות. סבב של <span className="num">14</span> שאלות נותן מפה ראשונה בלבד, וטווח האמת שלו רחב. הנתונים נשמרים רק במכשיר הזה.</p>
      <h3>איך משתמשים</h3>
      <p>בוחרים תשובה (או מקש <span className="num">1</span> עד <span className="num">4</span>), ואז ביטחון. אחרי כל תשובה רואים את העובדה ואת המקור. Enter ממשיך. במפת העומק לוחצים על תחום, ומודדים אותו לעומק.</p>
      <p className="src">ההשראה: מפת קרקעית האוקיינוס של <strong>מארי ת'ארפ</strong> Marie Tharp וברוס היזן Bruce Heezen, 1957. מה שלא נמדד נשאר לבן.</p>
    </Dialog>
  );
}

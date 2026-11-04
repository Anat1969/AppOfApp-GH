import { useState } from 'react';
import { ChartCard, LineChart, insightsFor, kfmt, type Series } from './Chart';
import { avg, employerTotal, forecast, mandatoryBy, nis, sum, type Params } from './calc';
import { MONTH_NAMES } from './parse';
import type { Slip } from './types';
import { M } from './ui';
import { computeRules } from './Views';

type Kind = 'in' | 'out' | 'save';
interface Measure { key: string; label: string; tone: Series['tone']; kind: Kind; get: (s: Slip) => number }

/** Every summary figure on the slip, once, so the home chart and its buttons speak the same language. */
export const MEASURES: Measure[] = [
  { key: 'bank', label: 'לבנק', tone: 'pos', kind: 'in', get: (s) => s.summary.bank },
  { key: 'gross', label: 'ברוטו', tone: 'ink', kind: 'in', get: (s) => s.summary.totalPay },
  { key: 'net', label: 'נטו', tone: 'save', kind: 'in', get: (s) => s.summary.net },
  { key: 'emp', label: 'מהמעסיק לחיסכון', tone: 'pos', kind: 'save', get: employerTotal },
  { key: 'mine', label: 'חיסכון שלך', tone: 'save', kind: 'save', get: (s) => s.summary.fundsDed },
  { key: 'tax', label: 'מס הכנסה', tone: 'neg', kind: 'out', get: (s) => mandatoryBy(s, 'מס הכנסה') },
  { key: 'bl', label: 'ביטוח לאומי ובריאות', tone: 'neg', kind: 'out', get: (s) => mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות') },
  { key: 'pers', label: 'ניכויים אישיים', tone: 'warn', kind: 'out', get: (s) => s.summary.personalDed },
];

const monthLabel = (s: Slip) => `${MONTH_NAMES[s.month - 1]} ${s.year}`;
const short = (s: Slip, multiYear: boolean) => MONTH_NAMES[s.month - 1].slice(0, 3) + (multiYear ? ` ${String(s.year).slice(2)}` : '');

/**
 * The home chart (Anat, 2026-11-04): all summary figures, two ways of looking. "תמונת מצב": one month or the average,
 * every figure as a bar, sorted by size or by group. "לאורך השנה": the figures she picks, month by month, together or
 * one above the other.
 */
export default function Dashboard({ slips, open }: { slips: Slip[]; open: (id: string) => void }) {
  const [mode, setMode] = useState<'now' | 'year'>(slips.length > 1 ? 'year' : 'now');
  const [when, setWhen] = useState<string>('avg');
  const [sort, setSort] = useState<'size' | 'group'>('group');
  const [picked, setPicked] = useState<string[]>(['bank', 'gross', 'tax']);
  const multiYear = new Set(slips.map((s) => s.year)).size > 1;
  const labels = slips.map((s) => short(s, multiYear));
  const one = slips.find((s) => s.id === when);
  const value = (m: Measure) => (one ? m.get(one) : avg(slips.map(m.get)));
  const gross = one ? one.summary.totalPay : avg(slips.map((s) => s.summary.totalPay));
  const groupOrder: Kind[] = ['in', 'save', 'out'];
  const bars = [...MEASURES].sort((a, b) => (sort === 'size' ? value(b) - value(a) : groupOrder.indexOf(a.kind) - groupOrder.indexOf(b.kind)));
  const max = Math.max(...MEASURES.map(value), 1);
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]));
  const sel = MEASURES.filter((m) => picked.includes(m.key));
  const first = sel[0];
  return (
    <section className="dash" aria-label="כל הנתונים המסכמים">
      <header className="dash-head">
        <h2>כל הנתונים במבט אחד</h2>
        <div className="seg-row" role="group" aria-label="סוג התצוגה">
          <button type="button" className={`btn ${mode === 'now' ? 'primary' : ''}`} aria-pressed={mode === 'now'} onClick={() => setMode('now')}>תמונת מצב</button>
          <button type="button" className={`btn ${mode === 'year' ? 'primary' : ''}`} aria-pressed={mode === 'year'} onClick={() => setMode('year')}>לאורך השנה</button>
        </div>
      </header>

      {mode === 'now' ? (
        <>
          <div className="dash-controls">
            <div className="seg-row" role="group" aria-label="חודש">
              <button type="button" className={`chip ${when === 'avg' ? 'on' : ''}`} onClick={() => setWhen('avg')}>ממוצע חודשי</button>
              {slips.map((s) => <button key={s.id} type="button" className={`chip ${when === s.id ? 'on' : ''}`} onClick={() => setWhen(s.id)}>{short(s, multiYear)}</button>)}
            </div>
            <div className="seg-row" role="group" aria-label="מיון">
              <button type="button" className={`chip ${sort === 'group' ? 'on' : ''}`} onClick={() => setSort('group')}>לפי סוג</button>
              <button type="button" className={`chip ${sort === 'size' ? 'on' : ''}`} onClick={() => setSort('size')}>לפי גודל</button>
            </div>
          </div>
          <ChartCard
            q={one ? `לאן הלך הכסף ב${monthLabel(one)}?` : `לאן הולך הכסף בחודש ממוצע?`}
            how="כל פס הוא סכום אחד. ירוק: מגיע אלייך, כחול: נחסך לך, אדום: יוצא, כתום: בחירה שלך. האחוז הוא מתוך הברוטו."
            insights={[
              `מכל **100 ₪** ברוטו נכנסים לבנק **${Math.round((value(MEASURES[0]) / gross) * 100)} ₪**, ועוד **${Math.round(((value(MEASURES[3]) + value(MEASURES[4])) / gross) * 100)} ₪** נחסכים לך בקופות.`,
              `מס הכנסה וביטוח לאומי לוקחים יחד **${nis(value(MEASURES[5]) + value(MEASURES[6]))}**, כלומר ${Math.round(((value(MEASURES[5]) + value(MEASURES[6])) / gross) * 100)}% מהברוטו.`,
            ]}
          >
            <div className="hbars">
              {bars.map((m) => (
                <div key={m.key} className={`hbar ${m.tone}`}>
                  <span className="hbar-l">{m.label}</span>
                  <span className="hbar-track"><span style={{ width: `${(value(m) / max) * 100}%` }} /></span>
                  <b>{nis(value(m))}</b>
                  <i>{`${Math.round((value(m) / gross) * 100)}%`}</i>
                </div>
              ))}
            </div>
          </ChartCard>
        </>
      ) : (
        <>
          <div className="dash-controls">
            <div className="seg-row wrap" role="group" aria-label="מה להציג">
              {MEASURES.map((m) => (
                <button key={m.key} type="button" className={`lc-key ${m.tone} ${picked.includes(m.key) ? 'on' : ''}`} aria-pressed={picked.includes(m.key)} onClick={() => toggle(m.key)}>
                  <span className="lc-dot" />{m.label}
                </button>
              ))}
            </div>
          </div>
          <ChartCard
            q="איך כל סכום השתנה בין החודשים?"
            how="בחרי למעלה אילו סכומים להשוות. 'אחד מעל השני' מציג כל סכום בקנה מידה משלו, עם הממוצע שלו. לחיצה על נקודה בטבלה פותחת את החודש."
            insights={first ? insightsFor(first.label, slips.map(first.get), labels, nis, first.kind !== 'out') : []}
          >
            <LineChart key={picked.join()} labels={labels} fmt={kfmt} series={sel.map((m) => ({ key: m.key, label: m.label, tone: m.tone, values: slips.map(m.get) }))} />
          </ChartCard>
          <div className="month-strip" role="list">
            {slips.map((s) => <button key={s.id} type="button" role="listitem" className="chip" onClick={() => open(s.id)}>{monthLabel(s)}</button>)}
          </div>
        </>
      )}
    </section>
  );
}

/** "השורה התחתונה" (Anat, 2026-11-04): after everything, what it all means and the one thing to do now. */
export function BottomLine({ slips, params, go }: { slips: Slip[]; params: Params; go: (v: 'rules' | 'pension') => void }) {
  const gross = sum(slips.map((s) => s.summary.totalPay));
  const bank = sum(slips.map((s) => s.summary.bank));
  const saved = sum(slips.map((s) => s.summary.fundsDed + employerTotal(s)));
  const taxes = sum(slips.map((s) => s.summary.mandatory));
  const f = forecast(slips, params);
  const rules = computeRules(slips, params);
  const red = rules.filter((r) => r.light === 'red');
  const amber = rules.filter((r) => r.light === 'amber');
  const next = red[0] ?? amber[0];
  const per100 = (v: number) => Math.round((v / gross) * 100);
  return (
    <section className="bottom" aria-label="השורה התחתונה">
      <span className="bottom-eyebrow">השורה התחתונה</span>
      <p className="bottom-main"><M>{`מכל **100 ₪** שהעירייה משלמת לך, **${per100(bank)} ₪** נכנסים לבנק, **${per100(saved)} ₪** נחסכים לך (כולל המעסיק), ו-**${per100(taxes)} ₪** הולכים למס וביטוח.`}</M></p>
      <ul className="bottom-points">
        <li className="pos"><M>{`בכל חודש נחסכים לך בממוצע **${nis(saved / slips.length)}**, יותר ממחצית מזה מהמעסיק.`}</M></li>
        <li className={rules.find((r) => r.title === 'הכנסה בפרישה')?.light ?? 'amber'}><M>{`בפרישה, לפי ההנחות היום: כ-**${nis(f.totalNet)}** נטו בחודש${Object.values(params.balances).some((b) => b > 0) ? '' : ', בלי הצבירה הקיימת (נמוך מהאמת)'}.`}</M></li>
        <li className={red.length ? 'red' : amber.length ? 'amber' : 'green'}><M>{`כללי אצבע: **${rules.length - red.length - amber.length}** בירוק, **${amber.length}** לבדיקה, **${red.length}** באדום.`}</M></li>
      </ul>
      {next && (
        <div className={`bottom-next ${next.light}`}>
          <b>הצעד הבא:</b> <span>{`${next.title}. ${next.why}`}</span>
          <button type="button" className="btn" onClick={() => go(next.title === 'הכנסה בפרישה' || next.title === 'דמי ניהול מהצבירה' ? 'pension' : 'rules')}>לפרטים</button>
        </div>
      )}
    </section>
  );
}

import { useMemo } from 'react';
import {
  avg, avgGroups, employerTotal, forecast, fundGroups, imputed, mandatoryBy, monthsBetween, n2, nis, parseDate, sum, type Params,
} from './calc';
import { explain } from './glossary';
import { MONTH_NAMES } from './parse';
import type { Row, Slip } from './types';
import { Insight, Kpi, M, NumField, Section, Stack } from './ui';
import Upload from './Upload';

export type View = 'home' | 'slip' | 'flow' | 'owed' | 'save' | 'pension' | 'time';
export const VIEWS: { id: View; label: string; title: string }[] = [
  { id: 'home', label: 'בית', title: 'מה יש בתלוש שלי' },
  { id: 'slip', label: 'מה יש בתלוש', title: 'כל שורה בתלוש, במילים פשוטות' },
  { id: 'flow', label: 'הכנסות והוצאות', title: 'מאיפה הכסף בא ולאן הוא הולך' },
  { id: 'owed', label: 'מה מגיע לי', title: 'זכויות, יתרות ומה לבדוק' },
  { id: 'save', label: 'איפה לחסוך', title: 'איפה אפשר לחסוך' },
  { id: 'pension', label: 'פנסיה', title: 'כמה תהיה הפנסיה ואיך היא תחולק' },
  { id: 'time', label: 'תכנון זמן', title: 'איך לתזמן כדי לקבל יותר' },
];

const monthLabel = (s: Slip) => `${MONTH_NAMES[s.month - 1]} ${s.year}`;
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : 'לא ידוע');

interface P { slips: Slip[]; params: Params; setParams: (p: Partial<Params>) => void; go: (v: View, m?: string) => void; month?: string; onSlip: (s: Slip) => void; onRemove: (id: string) => void }

function Empty({ onSlip }: { onSlip: (s: Slip) => void }) {
  return (
    <div className="empty">
      <Insight title="עוד אין תלושים במכשיר הזה" tone="amber">כדי לראות את החלק הזה צריך **לפחות תלוש אחד**. העלי את קובצי ה-PDF כאן.</Insight>
      <Upload onSlip={onSlip} />
    </div>
  );
}

/* ---------- Home ---------- */
export function Home({ slips, params, go, onSlip }: P) {
  const last = slips[slips.length - 1];
  const f = useMemo(() => (slips.length ? forecast(slips, params) : null), [slips, params]);
  const missing = last ? Array.from({ length: last.month }, (_, i) => i + 1).filter((m) => !slips.some((s) => s.year === last.year && s.month === m)) : [];
  const doors: { v: View; t: string; d: string }[] = last ? [
    { v: 'slip', t: 'מה יש בתלוש', d: `${last.payments.length + last.mandatory.length + last.personal.length + last.funds.length} שורות ב${monthLabel(last)}, כל אחת מוסברת.` },
    { v: 'flow', t: 'הכנסות והוצאות', d: `מכל 100 ₪ ברוטו מגיעים לבנק ${Math.round((sum(slips.map((s) => s.summary.bank)) / sum(slips.map((s) => s.summary.totalPay))) * 100)} ₪.` },
    { v: 'owed', t: 'מה מגיע לי', d: `יתרת חופשה ${n2(last.vacation?.close ?? 0)}, מחלה ${n2(last.sick?.close ?? 0)}, ${n2(last.info.creditPoints ?? 0)} נקודות זיכוי.` },
    { v: 'save', t: 'איפה לחסוך', d: 'דמי ניהול, ביטוחים, תרומות ושווי שנזקף לשכר.' },
    { v: 'pension', t: 'פנסיה', d: f ? `הערכה: כ-${nis(f.totalNet)} נטו בחודש מגיל ${params.retireAge}.` : '' },
    { v: 'time', t: 'תכנון זמן', d: 'מה שווה כל שנת עבודה נוספת, ומתי לפעול.' },
  ] : [];
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">תלושי שכר {last?.year ?? 2026}</span>
          <h1>מה יש בתלוש שלי</h1>
          <p className="hero-lead"><M>להבין את התלוש: **הכנסות, ניכויים, מה מגיע לי, איפה לחסוך, הפנסיה** ואיך לתכנן את הזמן כדי לקבל יותר.</M></p>
        </div>
        <div className="hero-sheet" aria-hidden="true">
          <div className="sheet s3" /><div className="sheet s2" />
          <div className="sheet s1">
            <div className="sheet-row big"><span>ברוטו</span><b>{last ? nis(last.summary.totalPay) : '—'}</b></div>
            <div className="sheet-row red"><span>ניכויי חובה</span><b>{last ? nis(-last.summary.mandatory) : '—'}</b></div>
            <div className="sheet-row blue"><span>חיסכון</span><b>{last ? nis(-last.summary.fundsDed) : '—'}</b></div>
            <div className="sheet-row green"><span>לבנק</span><b>{last ? nis(last.summary.bank) : '—'}</b></div>
          </div>
        </div>
      </section>

      <Upload onSlip={onSlip} compact={!!last} />
      {!last && (
        <>
          <div className="doors muted">
            {VIEWS.slice(1).map((v) => <div key={v.id} className="door off"><b>{v.label}</b><span>{v.title}</span></div>)}
          </div>
        </>
      )}

      {last && f && (
        <>
          <div className="kpis">
            <Kpi label="תלושים שנקראו" value={`${slips.length}`} note={missing.length ? `חסרים: ${missing.map((m) => MONTH_NAMES[m - 1]).join(', ')}` : 'כל החודשים עד עכשיו'} />
            <Kpi label="ברוטו ממוצע בחודש" value={nis(avg(slips.map((s) => s.summary.totalPay)))} />
            <Kpi label="לבנק בממוצע" value={nis(avg(slips.map((s) => s.summary.bank)))} tone="green" />
            <Kpi label="המעסיק מפקיד בשבילך" value={nis(avg(slips.map(employerTotal)))} note="בכל חודש, מעבר לברוטו" tone="blue" />
          </div>
          <div className="doors">
            {doors.map((d, i) => (
              <button key={d.v} type="button" className="door" onClick={() => go(d.v)}>
                <span className="door-n">0{i + 1}</span><b>{d.t}</b><span>{d.d}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- One slip, explained ---------- */
function Rows({ rows, sign = 1, extra }: { rows: Row[]; sign?: number; extra?: (r: Row) => string | undefined }) {
  return (
    <table className="rows">
      <tbody>
        {rows.map((r) => (
          <tr key={r.code + r.name}>
            <td className="r-name"><b>{r.name}</b><span className="r-code">{r.code}</span>{explain(r.name) && <span className="r-explain">{explain(r.name)}</span>}{extra?.(r) && <span className="r-extra">{extra(r)}</span>}</td>
            <td className={`r-amt ${sign < 0 ? 'neg' : ''}`}>{nis(sign * r.amount, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SlipView({ slips, params, go, month, onSlip, onRemove }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const s = slips.find((x) => x.id === month) ?? slips[slips.length - 1];
  const prev = slips[slips.indexOf(s) - 1];
  const groups = fundGroups(s);
  const imp = imputed(s);
  const changes = prev ? s.payments.concat(s.mandatory).filter((r) => {
    const p = prev.payments.concat(prev.mandatory).find((x) => x.code === r.code);
    return !p || Math.abs(p.amount - r.amount) > 1;
  }) : [];
  const unit = params.vacUnit === 'days' ? 'ימים' : 'שעות';
  return (
    <div>
      <div className="chips" role="tablist" aria-label="חודש">
        {slips.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === s.id} className={`chip ${x.id === s.id ? 'on' : ''}`} onClick={() => go('slip', x.id)}>{monthLabel(x)}</button>)}
      </div>

      <Section n="01" title={`${monthLabel(s)}: מהברוטו לבנק`} lead={`מתוך **${nis(s.summary.totalPay)}** ברוטו נכנסו לבנק **${nis(s.summary.bank)}**, כלומר ${Math.round((s.summary.bank / s.summary.totalPay) * 100)}%.`}>
        <div className="fall">
          {[
            { l: 'סך התשלומים (ברוטו)', v: s.summary.totalPay, t: 'ink' },
            { l: 'מס הכנסה', v: -mandatoryBy(s, 'מס הכנסה'), t: 'red' },
            { l: 'ביטוח לאומי ובריאות', v: -(mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות')), t: 'red' },
            { l: 'שכר נטו', v: s.summary.net, t: 'ink' },
            { l: 'פנסיה והשתלמות (חלקך)', v: -s.summary.fundsDed, t: 'blue' },
            { l: 'ניכויים אישיים', v: -s.summary.personalDed, t: 'amber' },
            { l: 'לבנק', v: s.summary.bank, t: 'green' },
          ].map((x) => (
            <div key={x.l} className={`fall-row ${x.t}`}>
              <span className="fall-l">{x.l}</span>
              <span className="fall-bar"><span style={{ width: `${(Math.abs(x.v) / s.summary.totalPay) * 100}%` }} /></span>
              <b>{nis(x.v, 2)}</b>
            </div>
          ))}
        </div>
        {s.warnings.length > 0 && <Insight title="משהו לא נקרא עד הסוף" tone="red">{s.warnings.join(' ')}</Insight>}
        {prev && (
          <p className="note"><M>{changes.length ? `לעומת ${monthLabel(prev)} השתנו: ${changes.map((c) => `**${c.name}**`).join(', ')}. ההפרש בבנק: ${nis(s.summary.bank - prev.summary.bank)}.` : `אין שינוי בשורות לעומת ${monthLabel(prev)}.`}</M></p>
        )}
      </Section>

      <Section n="02" title="תשלומים" lead="מה שהעירייה משלמת לך החודש.">
        <Rows rows={s.payments} extra={(r) => (r.qty && r.rate ? `${n2(r.qty)} x ${nis(r.rate, 2)}` : undefined)} />
      </Section>
      <Section n="03" title="ניכויי חובה" lead="מס וביטוחים שהחוק קובע.">
        <Rows rows={s.mandatory} sign={-1} />
        <p className="note"><M>{`המס השולי שלך **${n2(s.info.marginalTax ?? 0)}%**: מכל שקל נוסף ברוטו יורדים ${n2(s.info.marginalTax ?? 0)} אגורות למס, לפני ביטוח לאומי.`}</M></p>
      </Section>
      <Section n="04" title="חיסכון: פנסיה והשתלמות" lead="מה יורד ממך, ומה המעסיק מוסיף לאותה קופה.">
        <table className="rows funds">
          <thead><tr><th>קופה</th><th>ממך</th><th>מהמעסיק</th><th>פיצויים</th><th>סה"כ בחודש</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td className="r-name"><b>{g.name}</b><span className="r-extra">{`על ${nis(g.base)} | ממך ${n2(g.pctEmployee ?? 0)}%, מעסיק ${n2(g.pctEmployer ?? 0)}%${g.pctSeverance ? `, פיצויים ${n2(g.pctSeverance)}%` : ''}`}</span></td>
                <td className="r-amt">{nis(g.employee, 2)}</td><td className="r-amt">{nis(g.employer, 2)}</td><td className="r-amt">{nis(g.severance, 2)}</td>
                <td className="r-amt strong">{nis(g.employee + g.employer + g.severance, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note"><M>{`על כל **${nis(s.summary.fundsDed)}** שיורדים ממך, המעסיק מוסיף **${nis(employerTotal(s))}**.`}</M></p>
      </Section>
      {s.personal.length > 0 && (
        <Section n="05" title="ניכויים אישיים" lead="ניכויים שבחרת בהם, לא חובה.">
          <Rows rows={s.personal} sign={-1} extra={(r) => (r.name.includes('ביטוח') ? `${nis(r.amount * 12)} בשנה` : undefined)} />
        </Section>
      )}
      {imp.length > 0 && (
        <Section n="06" title="שווי שנזקף לשכר" lead="סכומים שלא נכנסים לחשבון, אבל משלמים עליהם מס.">
          <Rows rows={imp} extra={(r) => `מס משוער: ${nis((r.amount * (s.info.marginalTax ?? 0)) / 100)} בחודש`} />
        </Section>
      )}
      <Section n="07" title="יתרות ונתונים אישיים">
        <div className="kpis">
          {s.vacation && <Kpi label={`חופשה (${unit})`} value={n2(s.vacation.close)} note={`נצבר ${n2(s.vacation.credit)}, נוצל ${n2(s.vacation.used)}`} />}
          {s.sick && <Kpi label={`מחלה (${unit})`} value={n2(s.sick.close)} note={`נצבר ${n2(s.sick.credit)}, נוצל ${n2(s.sick.used)}`} />}
          <Kpi label="נקודות זיכוי" value={n2(s.info.creditPoints ?? 0)} note={s.info.family} />
          <Kpi label="ערך יום עבודה" value={nis(s.info.dayValue ?? 0, 2)} note={`ערך שעה ${nis(s.info.hourValue ?? 0, 2)}`} />
          {s.cumulative.grossTax != null && <Kpi label="ברוטו למס מתחילת השנה" value={nis(s.cumulative.grossTax)} note={`מס שנתי שנגבה ${nis(s.cumulative.annualTax ?? 0)}`} />}
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`למחוק את ${monthLabel(s)} מהמכשיר?`)) onRemove(s.id); }}>מחיקת החודש מהמכשיר</button>
          <span className="note">{s.fileName}</span>
        </div>
      </Section>
    </div>
  );
}

/* ---------- Income and expenses ---------- */
export function Flow({ slips, go, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const tot = (f: (s: Slip) => number) => sum(slips.map(f));
  const gross = tot((s) => s.summary.totalPay);
  const parts = [
    { label: 'לבנק', value: tot((s) => s.summary.bank), tone: 'green' },
    { label: 'מס הכנסה', value: tot((s) => mandatoryBy(s, 'מס הכנסה')), tone: 'red' },
    { label: 'ביטוח לאומי ובריאות', value: tot((s) => mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות')), tone: 'red2' },
    { label: 'פנסיה והשתלמות (חלקך)', value: tot((s) => s.summary.fundsDed), tone: 'blue' },
    { label: 'ניכויים אישיים', value: tot((s) => s.summary.personalDed), tone: 'amber' },
  ];
  const max = Math.max(...slips.map((s) => s.summary.totalPay + employerTotal(s)));
  const per100 = (v: number) => Math.round((v / gross) * 100);
  return (
    <div>
      <Section n="01" title={`${slips.length} חודשים יחד`} lead={`מכל **100 ₪** ברוטו: ${per100(parts[0].value)} לבנק, ${per100(parts[1].value)} מס הכנסה, ${per100(parts[2].value)} ביטוח לאומי ובריאות, ${per100(parts[3].value)} לחיסכון שלך.`}>
        <Stack parts={parts} total={gross} />
        <div className="kpis">
          <Kpi label="ברוטו מצטבר" value={nis(gross)} />
          <Kpi label="לבנק מצטבר" value={nis(parts[0].value)} tone="green" />
          <Kpi label="הפקדות המעסיק" value={nis(tot(employerTotal))} note="לא בתוך הברוטו" tone="blue" />
          <Kpi label="עלות מלאה שלך למעסיק" value={nis(gross + tot(employerTotal))} note="בלי ביטוח לאומי מעסיק" />
        </div>
      </Section>
      <Section n="02" title="חודש אחרי חודש" lead="כל עמודה היא חודש. החלק הבהיר למעלה הוא **מה שהמעסיק מפקיד** מעבר לברוטו. לחיצה פותחת את התלוש.">
        <div className="cols" role="list">
          {slips.map((s) => {
            const segs = [
              ['green', s.summary.bank], ['red', mandatoryBy(s, 'מס הכנסה')], ['red2', mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות')],
              ['blue', s.summary.fundsDed], ['amber', s.summary.personalDed], ['blue-light', employerTotal(s)],
            ] as [string, number][];
            return (
              <button key={s.id} type="button" role="listitem" className="col" onClick={() => go('slip', s.id)} title={`${monthLabel(s)}: לבנק ${nis(s.summary.bank)}`}>
                <span className="col-stack">{segs.map(([t, v]) => <span key={t} className={`seg ${t}`} style={{ height: `${(Math.max(0, v) / max) * 100}%` }} />)}</span>
                <span className="col-l">{MONTH_NAMES[s.month - 1].slice(0, 3)}</span>
                <span className="col-v">{Math.round(s.summary.bank / 1000)}K</span>
              </button>
            );
          })}
        </div>
      </Section>
      <Section n="03" title="הטבלה המלאה">
        <div className="scroll-x">
          <table className="grid">
            <thead><tr><th>חודש</th><th>ברוטו</th><th>מס הכנסה</th><th>ב"ל ובריאות</th><th>חיסכון שלך</th><th>אישיים</th><th>לבנק</th><th>מהמעסיק</th></tr></thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} onClick={() => go('slip', s.id)}>
                  <td>{monthLabel(s)}</td><td>{nis(s.summary.totalPay)}</td><td className="red">{nis(mandatoryBy(s, 'מס הכנסה'))}</td>
                  <td className="red">{nis(mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות'))}</td><td className="blue">{nis(s.summary.fundsDed)}</td>
                  <td>{nis(s.summary.personalDed)}</td><td className="green strong">{nis(s.summary.bank)}</td><td className="blue">{nis(employerTotal(s))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>סה"כ</td><td>{nis(gross)}</td><td>{nis(parts[1].value)}</td><td>{nis(parts[2].value)}</td><td>{nis(parts[3].value)}</td><td>{nis(parts[4].value)}</td><td>{nis(parts[0].value)}</td><td>{nis(tot(employerTotal))}</td></tr></tfoot>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ---------- What I am owed ---------- */
export function Owed({ slips, params, setParams, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const last = slips[slips.length - 1];
  const unitValue = params.vacUnit === 'days' ? last.info.dayValue ?? 0 : last.info.hourValue ?? 0;
  const unit = params.vacUnit === 'days' ? 'ימים' : 'שעות';
  const havraa = slips.flatMap((s) => s.payments.filter((p) => /הבראה/.test(p.name)).map((p) => ({ s, p })));
  const cp = last.info.creditPoints ?? 0;
  const zkifa = last.aux.find((a) => /זקיפת קרן/.test(a.name));
  const pensionBase = sum(fundGroups(last).filter((g) => g.kind === 'pension' && !/הוצאות/.test(g.name)).map((g) => g.base));
  const baseSalary = sum(last.payments.filter((p) => /שכר יסוד/.test(p.name)).map((p) => p.amount));
  const marg = (last.info.marginalTax ?? 0) / 100;
  return (
    <div>
      <div className="unit-switch">
        <span>יחידת היתרות בתלוש:</span>
        {(['days', 'hours'] as const).map((u) => <button key={u} type="button" className={`chip ${params.vacUnit === u ? 'on' : ''}`} onClick={() => setParams({ vacUnit: u })}>{u === 'days' ? 'ימים' : 'שעות'}</button>)}
        <span className="note">התלוש לא כותב את היחידה. אם הצבירה החודשית נראית גבוהה לימים, בחרי שעות.</span>
      </div>
      <div className="cards">
        {last.vacation && (
          <article className="card">
            <Insight title={`יתרת חופשה: ${n2(last.vacation.close)} ${unit}`} tone="green">{`לפי ערך ${params.vacUnit === 'days' ? 'יום' : 'שעה'} ${nis(unitValue, 2)} היא שווה כ-**${nis(last.vacation.close * unitValue)}**. ימים שלא נוצלו נפדים בסיום העבודה, ומעל תקרת הצבירה בהסכם הם נמחקים.`}</Insight>
            <p className="todo">לבדוק: מה תקרת הצבירה בהסכם הבכירים, וכמה חסר לה.</p>
          </article>
        )}
        {last.sick && (
          <article className="card">
            <Insight title={`צבירת מחלה: ${n2(last.sick.close)} ${unit}`} tone="blue">{`ימי מחלה לא נפדים לפי החוק, אבל **בהסכמים ברשויות המקומיות** יש לעיתים פדיון חלקי בפרישה.`}</Insight>
            <p className="todo">לבדוק במשאבי אנוש: האם יש פדיון ימי מחלה בפרישה, ובאיזה שיעור.</p>
          </article>
        )}
        <article className="card">
          {havraa.length
            ? <Insight title="דמי הבראה שולמו" tone="green">{havraa.map(({ s, p }) => `${monthLabel(s)}: **${nis(p.amount)}**`).join('. ')}</Insight>
            : <Insight title="דמי הבראה עוד לא הופיעו" tone="amber">{`בחודשים שנקראו אין שורת **הבראה**. ברוב הרשויות היא משולמת פעם בשנה, בקיץ.`}</Insight>}
          {!havraa.length && <p className="todo">כשיעלו כל החודשים: אם עדיין אין הבראה, לשאול במחלקת השכר.</p>}
        </article>
        <article className="card">
          <Insight title={`${n2(cp)} נקודות זיכוי, ${nis(cp * params.pointValue)} בחודש`} tone="green">{`כל נקודה מורידה **${nis(params.pointValue)}** מהמס בחודש. בסיס לתושבת: **2.75**; יש לך עוד ${n2(Math.max(0, cp - 2.75))}, לרוב בגלל ילדים.`}</Insight>
          <ul className="check">
            <li>תואר אקדמי שהסתיים בשנים האחרונות: נקודה או חצי לשנים הראשונות.</li>
            <li>ילד עם מוגבלות, או תשלום מזונות: נקודות נוספות.</li>
            <li>נקודה שחסרה בתלוש אפשר לבקש בטופס 101, או בהחזר מס עד 6 שנים אחורה.</li>
          </ul>
        </article>
        <article className="card">
          {pensionBase >= baseSalary - 1
            ? <Insight title="הפנסיה מופקדת על כל שכר היסוד" tone="green">{`בסיס ההפקדה **${nis(pensionBase)}** שווה לשכר היסוד. זה המצב התקין.`}</Insight>
            : <Insight title="חלק מהשכר לא מבוטח לפנסיה" tone="red">{`בסיס ההפקדה **${nis(pensionBase)}** נמוך משכר היסוד **${nis(baseSalary)}**. כדאי לבקש הסבר.`}</Insight>}
        </article>
        {zkifa && (
          <article className="card">
            <Insight title="ההשתלמות עוברת את התקרה הפטורה" tone="amber">{`המעסיק מפקיד מעל התקרה, ו-**${nis(zkifa.amount)}** בחודש נזקפים כהכנסה. המס עליהם כ-**${nis(zkifa.amount * marg)}**, והכסף עצמו נשאר שלך בקרן.`}</Insight>
          </article>
        )}
        <article className="card">
          <Insight title="החזר מס: מה כדאי לבדוק" tone="blue">{`אפשר להגיש בקשה להחזר מס **עד 6 שנים אחורה**. מה שהתלוש לא יודע עלייך, כדאי לרשום:`}</Insight>
          <ul className="check">
            <li>תרומות למוסד מוכר (סעיף 46): זיכוי של 35% מהתרומה.</li>
            <li>ביטוח חיים או אובדן כושר שמשולמים מחוץ לתלוש.</li>
            <li>הפקדה עצמאית לפנסיה.</li>
            <li>חודשים בלי עבודה, או שתי משרות בלי תיאום מס.</li>
          </ul>
        </article>
      </div>
    </div>
  );
}

/* ---------- Where to save ---------- */
export function Save({ slips, params, setParams, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const last = slips[slips.length - 1];
  const marg = (last.info.marginalTax ?? 0) / 100;
  const now = forecast(slips, params);
  const better = forecast(slips, { ...params, feeBalance: params.targetFee });
  const imp = imputed(last);
  const life = last.personal.filter((p) => /ביטוח/.test(p.name));
  return (
    <div>
      <Section n="01" title="דמי ניהול" lead="הסעיף הגדול ביותר שאפשר לשנות בטלפון אחד לקרן.">
        <div className="params">
          <NumField label="דמי ניהול מהצבירה היום" value={params.feeBalance} step={0.01} suffix="%" onChange={(v) => setParams({ feeBalance: v })} help="בדוח השנתי של הקרן" />
          <NumField label="דמי ניהול יעד" value={params.targetFee} step={0.01} suffix="%" onChange={(v) => setParams({ targetFee: v })} help="מה שאפשר לבקש במשא ומתן" />
        </div>
        <Insight title={`הפרש בפנסיה: ${nis(better.pension - now.pension)} בחודש`} tone="green">{`הורדה מ-**${n2(params.feeBalance)}%** ל-**${n2(params.targetFee)}%** מגדילה את הצבירה בפרישה בכ-**${nis(sum(better.funds.map((f) => f.balance)) - sum(now.funds.map((f) => f.balance)))}**.`}</Insight>
        {!Object.values(params.balances).some((b) => b > 0) && <p className="note">החישוב עוד בלי הצבירה הקיימת, ולכן ההפרש האמיתי גדול יותר. את הצבירה מזינים בדף הפנסיה.</p>}
      </Section>
      {imp.length > 0 && (
        <Section n="02" title="שווי שנזקף לשכר" lead="על הסכומים האלה משלמים מס, למרות שהם לא נכנסים לחשבון.">
          <div className="cards">
            {imp.map((r) => (
              <article key={r.code} className="card">
                <Insight title={`${r.name}: ${nis(r.amount * marg)} מס בחודש`} tone="amber">{`שווי של **${nis(r.amount)}** במס שולי ${n2(marg * 100)}% עולה כ-**${nis(r.amount * marg * 12)}** בשנה.`}</Insight>
              </article>
            ))}
          </div>
        </Section>
      )}
      {life.length > 0 && (
        <Section n="03" title="ביטוחים בתלוש">
          {life.map((r) => <Insight key={r.code} title={`${r.name}: ${nis(r.amount * 12)} בשנה`} tone="amber">{`לבדוק אם הכיסוי לא **כפול** לביטוח שכבר כלול בקרן הפנסיה (שארים ונכות), ואם הסכום עדיין נחוץ.`}</Insight>)}
        </Section>
      )}
      <Section n="04" title="תרומות" lead="תרומה למוסד עם סעיף 46 מחזירה 35% ממנה כזיכוי ממס.">
        <div className="params"><NumField label="סכום תרומות בשנה" value={params.donation} step={100} suffix="₪" onChange={(v) => setParams({ donation: v })} /></div>
        <Insight title={`החזר מס: ${nis(params.donation * 0.35)}`} tone="green">{`על תרומה של **${nis(params.donation)}** חוזרים **35%**, כל עוד הקבלה רשומה על שמך ומוגשת עד סוף השנה הבאה.`}</Insight>
      </Section>
    </div>
  );
}

/* ---------- Pension ---------- */
export function Pension({ slips, params, setParams, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const f = forecast(slips, params);
  const last = slips[slips.length - 1];
  const groups = avgGroups(slips);
  const hasBalances = Object.values(params.balances).some((b) => b > 0);
  const netNow = avg(slips.map((s) => s.summary.net));
  const share = (f.totalNet / netNow) * 100;
  return (
    <div>
      {!hasBalances && <Insight title="חסרה הצבירה שכבר יש לך" tone="red">{`בלי הצבירה הקיימת התחזית סופרת רק **הפקדות מהיום והלאה**. את הסכום מעתיקים מהדוח השנתי של כל קרן, למטה.`}</Insight>}
      <Section n="01" title={`כ-${nis(f.totalNet)} נטו בחודש`} lead={`הערכה ב**שקלים של היום**, מ${fmtDate(f.retireDate)} (גיל ${params.retireAge}), עוד **${f.months} חודשי** הפקדה.`}>
        <div className="kpis">
          <Kpi label="קצבה ברוטו מהקרנות" value={nis(f.pension)} tone="blue" />
          <Kpi label="פטור ממס (קיבוע זכויות)" value={nis(f.exempt)} tone="green" />
          <Kpi label="מס משוער" value={nis(-f.tax)} tone="red" />
          <Kpi label="קצבת זקנה, ביטוח לאומי" value={nis(f.oldAge)} note="הערכה" />
          <Kpi label="ביחס לנטו היום" value={`${Math.round(share)}%`} note={`נטו ממוצע היום ${nis(netNow)}`} />
          <Kpi label="קרן השתלמות בפרישה" value={nis(f.hishtalmut)} note="סכום חד-פעמי, פטור ממס" tone="green" />
        </div>
      </Section>
      <Section n="02" title="איך הקצבה תחולק" lead="מאילו מקורות יגיע הכסף בכל חודש, ומה ממנו פטור.">
        <Stack parts={[
          ...f.funds.map((x, i) => ({ label: x.name, value: x.pension, tone: i % 2 ? 'blue-light' : 'blue' })),
          { label: 'ביטוח לאומי', value: f.oldAge, tone: 'amber' },
        ]} />
        <Stack parts={[{ label: 'פטור ממס', value: f.exempt, tone: 'green' }, { label: 'חייב במס, נשאר לך', value: f.pension - f.exempt - f.tax, tone: 'blue-light' }, { label: 'מס', value: f.tax, tone: 'red' }]} />
        <table className="rows funds">
          <thead><tr><th>קרן</th><th>הפקדה חודשית</th><th>צבירה היום</th><th>צבירה בפרישה</th><th>קצבה</th></tr></thead>
          <tbody>{f.funds.map((x) => <tr key={x.key}><td className="r-name"><b>{x.name}</b></td><td className="r-amt">{nis(x.deposit)}</td><td className="r-amt">{nis(x.balanceNow)}</td><td className="r-amt">{nis(x.balance)}</td><td className="r-amt strong">{nis(x.pension)}</td></tr>)}</tbody>
        </table>
      </Section>
      <Section n="03" title="ההנחות" lead="כל מספר כאן ניתן לשינוי, והתחזית מתעדכנת מיד ונשמרת במכשיר.">
        <div className="params">
          {groups.filter((g) => g.kind === 'pension').map((g) => (
            <NumField key={g.key} label={`צבירה היום: ${g.name}`} value={params.balances[g.key] ?? 0} step={1000} suffix="₪" onChange={(v) => setParams({ balances: { ...params.balances, [g.key]: v } })} help="מהדוח השנתי או מהאזור האישי" />
          ))}
          <NumField label="צבירה היום: קרן השתלמות" value={params.hishtalmutBalance} step={1000} suffix="₪" onChange={(v) => setParams({ hishtalmutBalance: v })} />
          <NumField label="גיל פרישה" value={params.retireAge} step={0.25} onChange={(v) => setParams({ retireAge: v })} help="ברירת מחדל 65, לפי העלאת גיל הפרישה לנשים (2021). לאמת בביטוח לאומי." />
          <NumField label="מקדם המרה" value={params.coefficient} step={1} onChange={(v) => setParams({ coefficient: v })} help="בתקנון הקרן. צבירה חלקי מקדם = קצבה." />
          <NumField label="תשואה ריאלית בשנה" value={params.realReturn} step={0.1} suffix="%" onChange={(v) => setParams({ realReturn: v })} />
          <NumField label="דמי ניהול מהצבירה" value={params.feeBalance} step={0.01} suffix="%" onChange={(v) => setParams({ feeBalance: v })} />
          <NumField label="דמי ניהול מההפקדה" value={params.feeDeposit} step={0.1} suffix="%" onChange={(v) => setParams({ feeDeposit: v })} />
          <NumField label="עליית שכר ריאלית בשנה" value={params.salaryGrowth} step={0.1} suffix="%" onChange={(v) => setParams({ salaryGrowth: v })} />
          <NumField label="קצבת זקנה משוערת" value={params.oldAge} step={50} suffix="₪" onChange={(v) => setParams({ oldAge: v })} />
          <NumField label="תקרת קצבה מזכה" value={params.exemptCeiling} step={10} suffix="₪" onChange={(v) => setParams({ exemptCeiling: v })} />
          <NumField label="שיעור הפטור" value={params.exemptPct} step={1} suffix="%" onChange={(v) => setParams({ exemptPct: v })} help="67% לפורשים מ-2028" />
          <NumField label="נקודות זיכוי בפרישה" value={params.pointsAtRetirement} step={0.25} onChange={(v) => setParams({ pointsAtRetirement: v })} />
        </div>
        <ul className="check">
          <li>מסלול שארים: אם תבחרי שבן הזוג ימשיך לקבל קצבה, הקצבה שלך תהיה נמוכה יותר. הבחירה נעשית בפרישה.</li>
          <li>הפיצויים נשארים בקרן ונהפכים לקצבה. משיכה שלהם במזומן מקטינה את הקצבה וחייבת במס מעל התקרה.</li>
          <li>{`פיצויים, פדיון חופשה וההשתלמות לא כלולים בקצבה החודשית. נתוני הבסיס נלקחו מ-${slips.length} תלושים, האחרון ${monthLabel(last)}.`}</li>
        </ul>
      </Section>
    </div>
  );
}

/* ---------- Time planning ---------- */
export function Time({ slips, params, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const last = slips[slips.length - 1];
  const birth = parseDate(last.info.birthDate);
  const start = parseDate(last.info.startDate);
  const ages = [62, 63, 64, 65, 66, 67];
  const rows = ages.map((a) => {
    const coef = params.coefficient + (params.retireAge - a) * 8;
    const f = forecast(slips, params, a, coef);
    const bl = a >= params.retireAge ? params.oldAge : 0;
    return { a, f, total: f.net + bl, bl };
  });
  const bankAvg = avg(slips.map((s) => s.summary.bank));
  const vacStep = avg(slips.filter((s) => s.vacation).map((s) => s.vacation!.credit - s.vacation!.used));
  const f = forecast(slips, params);
  const vacMonths = slips.filter((s) => s.vacation).length;
  const vacAtRetire = (last.vacation?.close ?? 0) + vacStep * f.months;
  const unitValue = params.vacUnit === 'days' ? last.info.dayValue ?? 0 : last.info.hourValue ?? 0;
  const today = new Date();
  const dates: { d: Date | null; t: string; x: string }[] = [
    { d: today, t: 'היום', x: `${slips.length} תלושים נקראו` },
    { d: new Date(today.getFullYear(), 11, 31), t: 'סוף שנת המס', x: 'תרומות והפקדות עצמאיות עד התאריך הזה נכנסות לשנה הזאת.' },
    { d: start ? new Date(start.getFullYear() + 6, start.getMonth(), 1) : null, t: 'קרן ההשתלמות נזילה', x: 'בהנחה שהקרן נפתחה בתחילת העבודה בעירייה. קרן ותיקה יותר נזילה כבר עכשיו. אפשר להשאיר אותה ולהמשיך לצבור פטור ממס.' },
    { d: f.retireDate, t: `פרישה בגיל ${params.retireAge}`, x: vacMonths >= 3 ? `אם הקצב של החודשים שנקראו יימשך: יתרת חופשה של ${n2(vacAtRetire)}, כ-${nis(vacAtRetire * unitValue)} בפדיון, לפני תקרת הצבירה.` : 'תחזית יתרת החופשה תופיע כשיהיו לפחות 3 חודשים.' },
    { d: birth ? new Date(birth.getFullYear() + 70, birth.getMonth(), 1) : null, t: 'גיל 70', x: 'קצבת הזקנה משולמת בלי מבחן הכנסות.' },
  ];
  return (
    <div>
      <Section n="01" title="כל שנה נוספת שווה כסף" lead="אותן הנחות של דף הפנסיה, בגילי פרישה שונים. המקדם עולה בכ-8 לכל שנה מוקדמת (**הערכה גסה**).">
        <div className="scroll-x">
          <table className="grid">
            <thead><tr><th>גיל פרישה</th><th>מועד</th><th>חודשי הפקדה</th><th>קצבה נטו</th><th>+ ביטוח לאומי</th><th>סה"כ בחודש</th><th>שכר לבנק עד אז</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.a} className={r.a === params.retireAge ? 'sel' : ''}>
                  <td className="strong">{r.a}</td><td>{fmtDate(r.f.retireDate)}</td><td>{r.f.months}</td><td>{nis(r.f.net)}</td><td>{nis(r.bl)}</td>
                  <td className="green strong">{nis(r.total)}{i > 0 && <span className="delta">+{nis(r.total - rows[i - 1].total)}</span>}</td>
                  <td>{nis(bankAvg * r.f.months)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note"><M>{`כל שנת עבודה נוספת מוסיפה גם **${nis(bankAvg * 12)}** שכר לבנק, ודוחה את תחילת הקצבה בשנה.`}</M></p>
      </Section>
      <Section n="02" title="ציר זמן" lead="המועדים שבהם החלטה עושה הבדל.">
        <ol className="timeline">
          {dates.filter((x) => x.d).sort((a, b) => a.d!.getTime() - b.d!.getTime()).map((x) => (
            <li key={x.t}><span className="tl-date">{fmtDate(x.d)}</span><b>{x.t}</b><span>{x.x}</span>{x.d && x.d > today && <i>בעוד {Math.round(monthsBetween(today, x.d) / 12 * 10) / 10} שנים</i>}</li>
          ))}
        </ol>
      </Section>
      <Section n="03" title="ניהול נכון של הזמן">
        <div className="cards">
          <article className="card"><Insight title="חופשה: לנצל או לצבור" tone="amber">{`כל ${params.vacUnit === 'days' ? 'יום' : 'שעה'} שנצבר שווה היום **${nis(unitValue, 2)}**, וערכו עולה עם השכר. מעל תקרת הצבירה הוא נמחק, ולכן לנצל לפני שמגיעים אליה.`}</Insight></article>
          <article className="card"><Insight title="מועד הפרישה בתוך השנה" tone="blue">{`פדיון חופשה ומענקים בפרישה חייבים במס. **פריסה** על כמה שנות מס מקטינה אותו; לבדוק עם יועץ מס לפני שקובעים תאריך.`}</Insight></article>
          <article className="card"><Insight title="השתלמות: לא למשוך כשנפתחת" tone="green">{`קרן נזילה ממשיכה לצבור **פטור ממס** על הרווחים. משיכה רק כשיש לכסף שימוש טוב יותר.`}</Insight></article>
          <article className="card"><Insight title="פעם בשנה: הדוח השנתי" tone="blue">{`כשמגיע הדוח השנתי מהקרנות, לעדכן כאן את **הצבירה** ואת **דמי הניהול**. התחזית מתעדכנת מיד.`}</Insight></article>
        </div>
      </Section>
    </div>
  );
}

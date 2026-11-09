import { useMemo } from 'react';
import {
  avg, avgGroups, employerTotal, forecast, fundGroups, imputed, mandatoryBy, monthsBetween, n2, nis, parseDate, sum, type Params,
} from './calc';
import { explain } from './glossary';
import { MONTH_NAMES } from './parse';
import type { Row, Slip } from './types';
import { Band, Bars, Est, Insight, Kpi, M, Meter, NextSteps, NumField, Section, Source, Spark, Stack, Toc } from './ui';
import { ChartCard, LineChart, insightsFor, kfmt } from './Chart';
import Upload from './Upload';
import SlipMap from './SlipMap';
import Dashboard, { BottomLine } from './Dashboard';

export type View = 'home' | 'slip' | 'flow' | 'rules' | 'owed' | 'save' | 'pension' | 'time' | 'method';
export const VIEWS: { id: View; label: string; title: string }[] = [
  { id: 'home', label: 'בית', title: 'מה יש בתלוש שלי' },
  { id: 'slip', label: 'מה יש בתלוש', title: 'כל שורה בתלוש, במילים פשוטות' },
  { id: 'flow', label: 'הכנסות והוצאות', title: 'מאיפה הכסף בא ולאן הוא הולך' },
  { id: 'rules', label: 'כללי אצבע', title: 'איפה אני עומדת מול כללי האצבע' },
  { id: 'owed', label: 'מה מגיע לי', title: 'זכויות, יתרות ומה לבדוק' },
  { id: 'save', label: 'איפה לחסוך', title: 'איפה אפשר לחסוך' },
  { id: 'pension', label: 'פנסיה', title: 'כמה תהיה הפנסיה ואיך היא תחולק' },
  { id: 'time', label: 'תכנון זמן', title: 'איך לתזמן כדי לקבל יותר' },
  { id: 'method', label: 'איך מחשבים', title: 'איך מחשבים, ומה נבדק' },
];

const monthLabel = (s: Slip) => `${MONTH_NAMES[s.month - 1]} ${s.year}`;
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }) : 'לא ידוע');

interface P { slips: Slip[]; params: Params; setParams: (p: Partial<Params>) => void; go: (v: View, m?: string) => void; month?: string; onSlip: (s: Slip) => void; onRemove: (id: string) => void }

function Empty(_: { onSlip: (s: Slip) => void }) {
  return (
    <div className="empty">
      <Insight title="עוד אין תלושים במכשיר הזה" tone="amber">כדי לראות את החלק הזה צריך **לפחות תלוש אחד**. העלי את קובצי ה-PDF כאן.</Insight>
      <Upload />
    </div>
  );
}

/* ---------- Home ---------- */
export function Home({ slips, params, go }: P) {
  const last = slips[slips.length - 1];
  const f = useMemo(() => (slips.length ? forecast(slips, params) : null), [slips, params]);
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
      {/* The bottom line comes first: summary, then the detail (Anat, 2026-11-04). */}
      {last && f && <BottomLine slips={slips} params={params} go={(v) => go(v)} />}
      <section className={`hero ${last ? 'small' : ''}`}>
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

      {last && f && (
        <section className="answers" aria-label="שלוש התשובות">
          <article className="answer">
            <h2>כמה נכנס לי לבנק?</h2>
            <p className="big">{nis(avg(slips.map((s) => s.summary.bank)))}</p>
            <p className="sub">{`בממוצע בחודש, ${Math.round((sum(slips.map((s) => s.summary.bank)) / sum(slips.map((s) => s.summary.totalPay))) * 100)}% מהברוטו.`}</p>
          </article>
          <article className="answer">
            <h2>מה צברתי ועוד לא קיבלתי?</h2>
            <p className="big">{nis((last.vacation?.close ?? 0) * ((params.vacUnit === 'days' ? last.info.dayValue : last.info.hourValue) ?? 0))}</p>
            <p className="sub">{`יתרת חופשה ${n2(last.vacation?.close ?? 0)} ${params.vacUnit === 'days' ? 'ימים' : 'שעות'}, נפדית בסיום העבודה.`}</p>
          </article>
          <article className="answer">
            <h2>כמה אקבל בפרישה? <Est /></h2>
            <p className="big">{nis(f.totalNet)}</p>
            <p className="sub">{`נטו בחודש מגיל ${params.retireAge}, כולל ביטוח לאומי.${Object.values(params.balances).some((b) => b > 0) ? '' : ' עוד בלי הצבירה הקיימת.'}`}</p>
          </article>
        </section>
      )}

      {last && <Dashboard slips={slips} open={(id) => go('slip', id)} />}
      {!last && <Upload />}
      <SlipMap slips={slips} go={(id) => go('slip', id)} />
      {!last && (
        <>
          <div className="doors muted">
            {VIEWS.slice(1).map((v) => <div key={v.id} className="door off"><b>{v.label}</b><span>{v.title}</span></div>)}
          </div>
        </>
      )}


      {last && f && (
        <>
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
function Rows({ rows, sign = 1, extra, trend }: { rows: Row[]; sign?: number; extra?: (r: Row) => string | undefined; trend?: (r: Row) => number[] }) {
  return (
    <table className="rows">
      <tbody>
        {rows.map((r) => (
          <tr key={r.code + r.name}>
            <td className="r-name"><b>{r.name}</b><span className="r-code">{r.code}</span>{explain(r.name) && <span className="r-explain">{explain(r.name)}</span>}{extra?.(r) && <span className="r-extra">{extra(r)}</span>}</td>
            {trend && <td className="r-trend"><Spark values={trend(r)} /></td>}
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
  const recent = slips.slice(Math.max(0, slips.indexOf(s) - 11), slips.indexOf(s) + 1);
  const trend = (r: Row) => recent.map((x) => x.payments.concat(x.mandatory, x.personal, x.funds).find((y) => y.code === r.code)?.amount ?? 0);
  const src = `תלוש ${monthLabel(s)}${s.fileName ? `, ${s.fileName}` : ''}`;
  return (
    <div>
      <Band>
        <div className="chips" role="tablist" aria-label="חודש">
          {slips.map((x) => <button key={x.id} type="button" role="tab" aria-selected={x.id === s.id} className={`chip ${x.id === s.id ? 'on' : ''}`} onClick={() => go('slip', x.id)}>{monthLabel(x)}</button>)}
        </div>
        <Toc items={[['s-fall', 'סיכום'], ['s-io', 'הכנסות מול הוצאות'], ['s-save', 'חיסכון'], ['s-imp', 'שווי שנזקף'], ['s-bal', 'יתרות']]} />
      </Band>

      <Section n="01" id="s-fall" title={`כמה מהברוטו הגיע לבנק ב${monthLabel(s)}?`} lead={`מתוך **${nis(s.summary.totalPay)}** ברוטו נכנסו לבנק **${nis(s.summary.bank)}**, כלומר ${Math.round((s.summary.bank / s.summary.totalPay) * 100)}%.`}>
        <div className="vs3">
          <div className="vs ink"><span>ברוטו</span><b>{nis(s.summary.totalPay)}</b><i>כל מה שהעירייה שילמה</i></div>
          <div className="vs neutral"><span>נטו</span><b>{nis(s.summary.net)}</b><i>{`אחרי מס וביטוח: ${Math.round((s.summary.net / s.summary.totalPay) * 100)}% מהברוטו`}</i></div>
          <div className="vs pos"><span>לבנק</span><b>{nis(s.summary.bank)}</b><i>{`אחרי חיסכון וניכויים: ${Math.round((s.summary.bank / s.summary.totalPay) * 100)}%`}</i></div>
        </div>
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

      <Section n="02" id="s-io" title="מה נכנס ומה יצא?" lead={`נכנסו **${nis(s.summary.totalPay)}**, יצאו **${nis(s.summary.mandatory + s.summary.personalDed + s.summary.fundsDed)}**, מתוכם ${nis(s.summary.fundsDed)} לחיסכון שלך.`}>
        <div className="io">
          <div className="io-col in">
            <h3><span>הכנסות</span><b>{nis(s.summary.totalPay, 2)}</b></h3>
            <Rows trend={trend} rows={s.payments} extra={(r) => (r.qty && r.rate ? `${n2(r.qty)} x ${nis(r.rate, 2)}` : undefined)} />
          </div>
          <div className="io-col out">
            <h3><span>הוצאות וניכויים</span><b>{nis(-(s.summary.mandatory + s.summary.personalDed + s.summary.fundsDed), 2)}</b></h3>
            <Rows trend={trend} rows={[...s.mandatory, ...s.personal, ...s.funds.map((f) => ({ ...f, name: `חיסכון: ${f.name}` }))]} sign={-1} />
          </div>
        </div>
        <p className="note"><M>{`המס השולי שלך **${n2(s.info.marginalTax ?? 0)}%**: מכל 100 ₪ נוספים ברוטו יורדים ${n2(s.info.marginalTax ?? 0)} ₪ למס, לפני ביטוח לאומי.`}</M></p>
        <Source>{`${src}: "פירוט תשלומים וניכויים".`}</Source>
      </Section>
      <Section n="03" id="s-save" title="כמה נחסך לי, ומי שם את הכסף?" lead="מה יורד ממך, ומה המעסיק מוסיף לאותה קופה.">
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
        <Source>{`${src}: "קופות גמל" והפרשות המעסיק ב"נתוני עזר".`}</Source>
      </Section>
      {imp.length > 0 && (
        <Section n="04" id="s-imp" title="על מה אני משלמת מס בלי לקבל כסף?" lead="סכומים שלא נכנסים לחשבון, אבל נוספים לשכר החייב במס.">
          <Rows rows={imp} extra={(r) => `מס משוער: ${nis((r.amount * (s.info.marginalTax ?? 0)) / 100)} בחודש`} />
        </Section>
      )}
      <Section n="05" id="s-bal" title="מה צברתי?">
        <div className="kpis">
          {s.vacation && <Kpi label={`חופשה (${unit})`} value={n2(s.vacation.close)} note={`נצבר ${n2(s.vacation.credit)}, נוצל ${n2(s.vacation.used)}`} />}
          {s.sick && <Kpi label={`מחלה (${unit})`} value={n2(s.sick.close)} note={`נצבר ${n2(s.sick.credit)}, נוצל ${n2(s.sick.used)}`} />}
          <Kpi label="נקודות זיכוי" value={n2(s.info.creditPoints ?? 0)} note={s.info.family} />
          <Kpi label="ערך יום עבודה" value={nis(s.info.dayValue ?? 0, 2)} note={`ערך שעה ${nis(s.info.hourValue ?? 0, 2)}`} />
          {s.cumulative.grossTax != null && <Kpi label="ברוטו למס מתחילת השנה" value={nis(s.cumulative.grossTax)} note={`מס שנתי שנגבה ${nis(s.cumulative.annualTax ?? 0)}`} />}
        </div>
        <div className="row-actions">
          <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`למחוק את ${monthLabel(s)} מהמכשיר?`)) onRemove(s.id); }}>מחיקת החודש מהמכשיר</button>
        </div>
        <Source>{`${src}. ${s.warnings.length ? 'בדיקת התאמה: יש הפרש, ראי למעלה.' : 'בדיקת התאמה: כל השורות מסתכמות לשורת הסיכום.'}`}</Source>
      </Section>
      <NextSteps items={[
        ...(s.warnings.length ? [{ text: 'יש הפרש בין השורות לסיכום. כדאי להשוות לתלוש המקורי.', light: 'red' as const, action: { label: 'איך מחשבים', onClick: () => go('method') } }] : []),
        ...(changes.length && prev ? [{ text: `השתנו ${changes.length} שורות לעומת ${monthLabel(prev)}. אם השינוי לא ברור, לשאול במחלקת השכר.`, light: 'amber' as const, action: { label: monthLabel(prev), onClick: () => go('slip', prev.id) } }] : []),
        ...(imp.length ? [{ text: `על שווי של **${nis(sum(imp.map((r) => r.amount)))}** בחודש את משלמת מס בלי לקבל כסף. כדאי להבין אם זה משתלם.`, light: 'amber' as const, action: { label: 'איפה לחסוך', onClick: () => go('save') } }] : []),
        { text: 'לראות את כל החודשים יחד, ומה השתנה לאורך השנה.', light: 'green' as const, action: { label: 'הכנסות והוצאות', onClick: () => go('flow') } },
      ]} />
    </div>
  );
}

/* ---------- Income and expenses ---------- */
export function Flow({ slips, go, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const tot = (f: (s: Slip) => number) => sum(slips.map(f));
  const gross = tot((s) => s.summary.totalPay);
  const net = tot((s) => s.summary.net);
  const tax = tot((s) => mandatoryBy(s, 'מס הכנסה'));
  const bl = tot((s) => mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות'));
  const mine = tot((s) => s.summary.fundsDed);
  const pers = tot((s) => s.summary.personalDed);
  const bank = tot((s) => s.summary.bank);
  const emp = tot(employerTotal);
  const per100 = (v: number) => Math.round((v / gross) * 100);
  const labels = slips.map((s) => MONTH_NAMES[s.month - 1].slice(0, 3) + (new Set(slips.map((x) => x.year)).size > 1 ? ` ${String(s.year).slice(2)}` : ''));
  const k = kfmt;
  const bankSeries = slips.map((s) => s.summary.bank);
  return (
    <div>
      <Band><Toc items={[['f-sum', 'ברוטו מול נטו'], ['f-line', 'לאורך החודשים'], ['f-save', 'חיסכון'], ['f-table', 'כל המספרים']]} /></Band>
      <Section n="01" id="f-sum" title="כמה ברוטו, כמה נטו, וכמה הגיע לבנק?" lead={`מכל **100 ₪** ברוטו: ${per100(bank)} לבנק, ${per100(tax)} מס הכנסה, ${per100(bl)} ביטוח לאומי ובריאות, ${per100(mine)} לחיסכון שלך.`}>
        <div className="vs3">
          <div className="vs ink"><span>{`ברוטו, ${slips.length} חודשים`}</span><b>{nis(gross)}</b><i>{`ממוצע ${nis(gross / slips.length)} בחודש`}</i></div>
          <div className="vs neutral"><span>נטו</span><b>{nis(net)}</b><i>{`${per100(net)}% מהברוטו`}</i></div>
          <div className="vs pos"><span>לבנק</span><b>{nis(bank)}</b><i>{`${per100(bank)}% מהברוטו`}</i></div>
        </div>
        <div className="io sums">
          <div className="io-col in">
            <h3><span>נכנס</span><b>{nis(gross + emp)}</b></h3>
            <dl className="io-dl"><dt>ברוטו</dt><dd>{nis(gross)}</dd><dt>הפקדות המעסיק לחיסכון שלך</dt><dd>{nis(emp)}</dd></dl>
          </div>
          <div className="io-col out">
            <h3><span>יצא</span><b>{nis(-(tax + bl + pers))}</b></h3>
            <dl className="io-dl"><dt>מס הכנסה</dt><dd>{nis(-tax)}</dd><dt>ביטוח לאומי ובריאות</dt><dd>{nis(-bl)}</dd><dt>ניכויים אישיים</dt><dd>{nis(-pers)}</dd></dl>
          </div>
        </div>
        <Stack parts={[
          { label: 'לבנק', value: bank, tone: 'green' },
          { label: 'חיסכון שלך', value: mine, tone: 'blue' },
          { label: 'מס הכנסה', value: tax, tone: 'red' },
          { label: 'ביטוח לאומי ובריאות', value: bl, tone: 'red2' },
          { label: 'ניכויים אישיים', value: pers, tone: 'amber' },
        ]} total={gross} />
        <Source>{`${slips.length} תלושים, שורת הסיכום בתחתית כל תלוש.`}</Source>
      </Section>
      <Section n="02" id="f-line" title="איך זה משתנה מחודש לחודש?" lead="כל קו הוא סכום אחד לאורך כל החודשים. לחיצה על שם בודדת את הקו ומציגה את הממוצע שלו.">
        <ChartCard q="ברוטו, נטו ולבנק: האם החודש היה רגיל?" how="כל נקודה היא חודש; ריחוף מציג את הסכום. ירוק הוא מה שהגיע אלייך, אדום מה שיצא למס." insights={insightsFor('הסכום לבנק', bankSeries, labels, nis)}>
          <LineChart labels={labels} fmt={k} series={[
            { key: 'gross', label: 'ברוטו', values: slips.map((s) => s.summary.totalPay), tone: 'ink' },
            { key: 'net', label: 'נטו', values: slips.map((s) => s.summary.net), tone: 'save' },
            { key: 'bank', label: 'לבנק', values: bankSeries, tone: 'pos' },
            { key: 'tax', label: 'מס הכנסה', values: slips.map((s) => mandatoryBy(s, 'מס הכנסה')), tone: 'neg' },
          ]} />
        </ChartCard>
      </Section>
      <Section n="03" id="f-save" title="כמה נחסך כל חודש, וכמה מזה מהמעסיק?">
        <ChartCard q="החלק שלך מול החלק של המעסיק" how="כחול: מה שיורד ממך לקופות. ירוק: מה שהמעסיק מוסיף, מעבר לברוטו." insights={insightsFor('הפקדת המעסיק', slips.map(employerTotal), labels, nis)}>
          <LineChart labels={labels} fmt={k} series={[
            { key: 'mine', label: 'ממך', values: slips.map((s) => s.summary.fundsDed), tone: 'save' },
            { key: 'emp', label: 'מהמעסיק', values: slips.map(employerTotal), tone: 'pos' },
          ]} />
        </ChartCard>
      </Section>
      <Section n="04" id="f-table" title="כל המספרים, חודש בחודש" lead="ירוק: עלה מהחודש הקודם. אדום: ירד. לחיצה על שורה פותחת את התלוש.">
        <div className="scroll-x">
          <table className="grid">
            <thead><tr><th>חודש</th><th>ברוטו</th><th>נטו</th><th>מס הכנסה</th><th>ב"ל ובריאות</th><th>חיסכון שלך</th><th>לבנק</th><th>שינוי בבנק</th><th>מהמעסיק</th></tr></thead>
            <tbody>
              {slips.map((s, i) => {
                const d = i ? s.summary.bank - slips[i - 1].summary.bank : 0;
                return (
                  <tr key={s.id} onClick={() => go('slip', s.id)}>
                    <td>{monthLabel(s)}</td><td>{nis(s.summary.totalPay)}</td><td>{nis(s.summary.net)}</td><td className="red">{nis(mandatoryBy(s, 'מס הכנסה'))}</td>
                    <td className="red">{nis(mandatoryBy(s, 'לאומי') + mandatoryBy(s, 'בריאות'))}</td><td className="blue">{nis(s.summary.fundsDed)}</td>
                    <td className="green strong">{nis(s.summary.bank)}</td>
                    <td className={!i || Math.abs(d) < 1 ? '' : d > 0 ? 'green' : 'red'}>{!i ? '—' : `${d > 0 ? '+' : ''}${nis(d)}`}</td>
                    <td className="green">{nis(employerTotal(s))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><td>סה"כ</td><td>{nis(gross)}</td><td>{nis(net)}</td><td>{nis(tax)}</td><td>{nis(bl)}</td><td>{nis(mine)}</td><td>{nis(bank)}</td><td /><td>{nis(emp)}</td></tr></tfoot>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ---------- Rules of thumb ---------- */
export type Light = 'green' | 'amber' | 'red';
export interface Rule { title: string; rule: string; mine: string; light: Light; why: string }

export function computeRules(slips: Slip[], params: Params): Rule[] {
  const last = slips[slips.length - 1];
  const groups = fundGroups(last);
  const base = sum(last.payments.filter((p) => /שכר יסוד/.test(p.name)).map((p) => p.amount)) || last.summary.base;
  const pens = groups.filter((g) => g.kind === 'pension' && !/הוצאות/.test(g.name));
  const pensBase = sum(pens.map((g) => g.base));
  const pensPct = base ? (sum(pens.map((g) => g.employee + g.employer + g.severance)) / base) * 100 : 0;
  const hish = groups.find((g) => g.kind === 'hishtalmut');
  const hishPct = hish ? (hish.pctEmployee ?? 0) + (hish.pctEmployer ?? 0) : 0;
  const f = forecast(slips, params);
  const netNow = avg(slips.map((s) => s.summary.net));
  const share = (f.totalNet / netNow) * 100;
  const bankAvg = avg(slips.map((s) => s.summary.bank));
  const vac = slips.filter((s) => s.vacation);
  const vacNet = sum(vac.map((s) => s.vacation!.credit - s.vacation!.used));
  const marg = last.info.marginalTax ?? 0;
  const life = last.personal.filter((p) => /ביטוח/.test(p.name));
  const havraa = slips.some((s) => s.payments.some((p) => /הבראה/.test(p.name)));
  return [
    { title: 'חיסכון לפנסיה', rule: 'לפחות 18.5% מהשכר (6% עובד, 6.5% מעסיק, 6% פיצויים)', mine: `${n2(pensPct)}%`, light: pensPct >= 18.5 ? 'green' : 'red', why: pensPct >= 18.5 ? 'מעל המינימום בחוק: ההפקדות מלאות.' : 'מתחת למינימום. לבדוק מול מחלקת השכר.' },
    { title: 'פנסיה על כל השכר', rule: 'בסיס ההפקדה שווה לשכר היסוד', mine: `${nis(pensBase)} מתוך ${nis(base)}`, light: pensBase >= base - 1 ? 'green' : 'red', why: pensBase >= base - 1 ? 'כל שכר היסוד מבוטח.' : 'חלק מהשכר לא מבוטח לפנסיה.' },
    { title: 'קרן השתלמות', rule: '10% בסך הכול (2.5% ממך, 7.5% מהמעסיק)', mine: hish ? `${n2(hishPct)}%` : 'אין', light: hishPct >= 10 ? 'green' : hish ? 'amber' : 'red', why: hishPct >= 10 ? 'בתקרה המלאה: חיסכון פטור ממס.' : 'כדאי לבדוק אם אפשר להגדיל.' },
    { title: 'הכנסה בפרישה', rule: 'לפחות 70% מהנטו של היום', mine: `${Math.round(share)}%`, light: share >= 70 ? 'green' : share >= 50 ? 'amber' : 'red', why: Object.values(params.balances).some((b) => b > 0) ? 'לפי התחזית בדף הפנסיה.' : 'עוד בלי הצבירה הקיימת, ולכן נמוך מהאמת. להזין צבירה בדף הפנסיה.' },
    { title: 'דמי ניהול מהצבירה', rule: `עד ${n2(params.targetFee)}% (היעד שקבעת)`, mine: `${n2(params.feeBalance)}%`, light: params.feeBalance <= params.targetFee ? 'green' : params.feeBalance <= 0.3 ? 'amber' : 'red', why: 'אחוז קטן מהצבירה מצטבר לעשרות אלפי שקלים עד הפרישה.' },
    { title: 'כרית ביטחון', rule: '3 עד 6 חודשי הכנסה בחיסכון נזיל', mine: `${nis(bankAvg * 3)} עד ${nis(bankAvg * 6)}`, light: 'amber', why: 'התלוש לא יודע כמה יש בחשבון. זה היעד לפי ההכנסה שלך.' },
    { title: 'ניצול חופשה', rule: 'לנצל בערך את מה שנצבר בשנה', mine: vac.length >= 3 ? `${vacNet >= 0 ? '+' : ''}${n2(vacNet)} ב-${vac.length} חודשים` : 'צריך 3 חודשים', light: vac.length < 3 ? 'amber' : vacNet > 5 ? 'amber' : 'green', why: 'צבירה מעל תקרת ההסכם נמחקת; ניצול שומר על הערך.' },
    { title: 'מס שולי', rule: 'לדעת כמה נשאר מכל שקל נוסף', mine: `${n2(marg)}%`, light: marg >= 47 ? 'red' : marg >= 35 ? 'amber' : 'green', why: `מכל 100 ₪ נוספים ברוטו נשארים לך כ-${Math.round(100 - marg - 12)} ₪ אחרי מס וביטוח לאומי (הערכה).` },
    { title: 'ביטוח חיים בתלוש', rule: 'לא לשלם פעמיים על אותו כיסוי', mine: life.length ? `${nis(sum(life.map((l) => l.amount)) * 12)} בשנה` : 'אין', light: life.length ? 'amber' : 'green', why: life.length ? 'קרן הפנסיה כבר כוללת כיסוי שארים. לבדוק כפילות.' : 'אין ניכוי ביטוח אישי.' },
    { title: 'דמי הבראה', rule: 'משולמים פעם בשנה', mine: havraa ? 'שולמו' : 'עוד לא הופיעו', light: havraa ? 'green' : 'amber', why: havraa ? 'נמצאה שורת הבראה בתלושים.' : 'אם עד הסתיו אין שורה כזו, לשאול במחלקת השכר.' },
  ];
}

export function Rules({ slips, params, go, onSlip }: P) {
  if (!slips.length) return <Empty onSlip={onSlip} />;
  const last = slips[slips.length - 1];
  const rules = computeRules(slips, params);
  const count = (l: Light) => rules.filter((r) => r.light === l).length;
  return (
    <div>
      <section className="answers" aria-label="סיכום הרמזור">
        <article className="answer light-green"><h2>עומדת בכלל</h2><p className="big">{count('green')}</p><p className="sub">אין מה לעשות כרגע.</p></article>
        <article className="answer light-amber"><h2>כדאי לבדוק</h2><p className="big">{count('amber')}</p><p className="sub">חסר מידע או שיש מקום לשיפור.</p></article>
        <article className="answer light-red"><h2>לא עומדת בכלל</h2><p className="big">{count('red')}</p><p className="sub">כאן כדאי לפעול קודם.</p></article>
      </section>
      <Section n="01" title="כל כלל, והמספר שלך מולו" lead="אדום קודם, אחר כך כתום, ובסוף ירוק: מה שדורש פעולה נמצא למעלה.">
        <ol className="rules">
          {[...rules].sort((a, b) => ['red', 'amber', 'green'].indexOf(a.light) - ['red', 'amber', 'green'].indexOf(b.light)).map((r) => (
            <li key={r.title} className={`rule ${r.light}`}>
              <span className="light" aria-label={{ green: 'ירוק', amber: 'כתום', red: 'אדום' }[r.light]} />
              <div className="rule-body"><b>{r.title}</b><span className="rule-rule">{r.rule}</span><span className="rule-why"><M>{r.why}</M></span></div>
              <div className="rule-mine">{r.mine}</div>
            </li>
          ))}
        </ol>
        <p className="note">כללי אצבע מקובלים בתכנון כלכלי אישי, לא ייעוץ. המספרים שלך מהתלוש האחרון ({monthLabel(last)}) ומההנחות בדף הפנסיה.</p>
        <div className="row-actions"><button type="button" className="btn" onClick={() => go('pension')}>להנחות הפנסיה</button><button type="button" className="btn" onClick={() => go('method')}>איך מחשבים</button></div>
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
          <Meter label="נקודות זיכוי מול הבסיס לתושבת" value={cp} target={2.75} max={Math.max(7, cp + 1)} fmt={(n) => n2(n)} />
          <Insight title={`${n2(cp)} נקודות זיכוי, ${nis(cp * params.pointValue)} בחודש`} tone="green">{`כל נקודה מורידה **${nis(params.pointValue)}** מהמס בחודש. בסיס לתושבת: **2.75**; יש לך עוד ${n2(Math.max(0, cp - 2.75))}, לרוב בגלל ילדים.`}</Insight>
          <ul className="check">
            <li>תואר אקדמי שהסתיים בשנים האחרונות: נקודה או חצי לשנים הראשונות.</li>
            <li>ילד עם מוגבלות, או תשלום מזונות: נקודות נוספות.</li>
            <li>נקודה שחסרה בתלוש אפשר לבקש בטופס 101, או בהחזר מס עד 6 שנים אחורה.</li>
          </ul>
        </article>
        <article className="card">
          <Meter label="בסיס ההפקדה לפנסיה מתוך שכר היסוד" value={baseSalary ? (pensionBase / baseSalary) * 100 : 0} target={100} max={110} fmt={(n) => `${Math.round(n)}%`} />
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
      <NextSteps items={[
        { text: 'לבקש ממשאבי אנוש את תקרת צבירת החופשה, והאם יש פדיון ימי מחלה בפרישה.', light: 'amber' },
        ...(!havraa.length ? [{ text: 'דמי הבראה עוד לא הופיעו. אם עד הסתיו אין שורה כזו, לשאול במחלקת השכר.', light: 'amber' as const }] : []),
        { text: 'לבדוק אם מגיעות לך נקודות זיכוי נוספות, ואם כן להגיש בקשה להחזר מס עד 6 שנים אחורה.', light: 'green' },
      ]} />
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
      <Band><Toc items={[['v-fee', 'דמי ניהול'], ['v-imp', 'שווי שנזקף'], ['v-ins', 'ביטוחים'], ['v-don', 'תרומות']]} /></Band>
      <Section n="01" id="v-fee" title="כמה עולים לי דמי הניהול?" lead="הסעיף הגדול ביותר שאפשר לשנות בשיחת טלפון אחת לקרן.">
        <Meter label="דמי ניהול מהצבירה" value={params.feeBalance} target={params.targetFee} max={0.6} lowerIsBetter fmt={(n) => `${n2(n)}%`} note="התקרה בחוק לקרן פנסיה: 0.5%" />
        <Meter label="דמי ניהול מההפקדה" value={params.feeDeposit} target={1} max={6.5} lowerIsBetter fmt={(n) => `${n2(n)}%`} note="התקרה בחוק: 6%" />
        <div className="params">
          <NumField label="דמי ניהול מהצבירה היום" value={params.feeBalance} step={0.01} suffix="%" onChange={(v) => setParams({ feeBalance: v })} help="בדוח השנתי של הקרן" />
          <NumField label="דמי ניהול יעד" value={params.targetFee} step={0.01} suffix="%" onChange={(v) => setParams({ targetFee: v })} help="מה שאפשר לבקש במשא ומתן" />
        </div>
        <Bars fmt={nis} rows={[
          { label: `צבירה בפרישה, ${n2(params.feeBalance)}%`, value: sum(now.funds.map((f) => f.balance)), tone: 'neg' },
          { label: `צבירה בפרישה, ${n2(params.targetFee)}%`, value: sum(better.funds.map((f) => f.balance)), tone: 'pos' },
        ]} />
        <Insight title={`הפרש בפנסיה: ${nis(better.pension - now.pension)} בחודש`} tone="green">{`הורדה מ-**${n2(params.feeBalance)}%** ל-**${n2(params.targetFee)}%** מגדילה את הצבירה בפרישה בכ-**${nis(sum(better.funds.map((f) => f.balance)) - sum(now.funds.map((f) => f.balance)))}**.`}</Insight>
        {!Object.values(params.balances).some((b) => b > 0) && <p className="note">החישוב עוד בלי הצבירה הקיימת, ולכן ההפרש האמיתי גדול יותר. את הצבירה מזינים בדף הפנסיה.</p>}
      </Section>
      {imp.length > 0 && (
        <Section n="02" id="v-imp" title="כמה מס על שווי שלא נכנס לחשבון?" lead="על הסכומים האלה משלמים מס, למרות שהם לא נכנסים לחשבון.">
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
        <Section n="03" id="v-ins" title="האם הביטוח בתלוש נחוץ?">
          {life.map((r) => <Insight key={r.code} title={`${r.name}: ${nis(r.amount * 12)} בשנה`} tone="amber">{`לבדוק אם הכיסוי לא **כפול** לביטוח שכבר כלול בקרן הפנסיה (שארים ונכות), ואם הסכום עדיין נחוץ.`}</Insight>)}
        </Section>
      )}
      <Section n="04" id="v-don" title="כמה יחזור לי מתרומות?" lead="תרומה למוסד עם סעיף 46 מחזירה 35% ממנה כזיכוי ממס.">
        <div className="params"><NumField label="סכום תרומות בשנה" value={params.donation} step={100} suffix="₪" onChange={(v) => setParams({ donation: v })} /></div>
        <Insight title={`החזר מס: ${nis(params.donation * 0.35)}`} tone="green">{`על תרומה של **${nis(params.donation)}** חוזרים **35%**, כל עוד הקבלה רשומה על שמך ומוגשת עד סוף השנה הבאה.`}</Insight>
      </Section>
      <NextSteps items={[
        { text: `להתקשר לקרן הפנסיה ולבקש דמי ניהול של **${n2(params.targetFee)}%** מהצבירה. זו שיחה אחת.`, light: params.feeBalance > params.targetFee ? 'red' : 'green' },
        ...(life.length ? [{ text: 'לבדוק שביטוח החיים בתלוש לא כפול לכיסוי שבקרן הפנסיה.', light: 'amber' as const }] : []),
        { text: 'לשמור קבלות על תרומות, ולהגיש אותן בבקשה להחזר מס.', light: 'green' },
      ]} />
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
      <Band><Toc items={[['p-sum', 'כמה אקבל'], ['p-split', 'איך תחולק'], ['p-assume', 'ההנחות']]} /></Band>
      <Section n="01" id="p-sum" title={`כמה אקבל בחודש בפרישה? כ-${nis(f.totalNet)} נטו`} lead={`הערכה ב**שקלים של היום**, מ${fmtDate(f.retireDate)} (גיל ${params.retireAge}), עוד **${f.months} חודשי** הפקדה.`}>
        <div className="kpis">
          <Kpi est label="קצבה ברוטו מהקרנות" value={nis(f.pension)} tone="blue" />
          <Kpi est label="פטור ממס (קיבוע זכויות)" value={nis(f.exempt)} tone="green" />
          <Kpi est label="מס משוער" value={nis(-f.tax)} tone="red" />
          <Kpi est label="קצבת זקנה, ביטוח לאומי" value={nis(f.oldAge)} />
          <Kpi est label="קרן השתלמות בפרישה" value={nis(f.hishtalmut)} note="סכום חד-פעמי, פטור ממס" tone="green" />
        </div>
        <Meter label="הכנסה בפרישה מתוך הנטו היום" value={share} target={70} max={110} fmt={(n) => `${Math.round(n)}%`} note={`כלל אצבע בתכנון פנסיוני. נטו ממוצע היום ${nis(netNow)}`} />
        <Source>{`ממוצע ההפקדות ב-${Math.min(12, slips.length)} התלושים האחרונים, והנחות שאפשר לשנות למטה.`}</Source>
      </Section>
      <Section n="02" id="p-split" title="איך הקצבה תחולק?" lead="מאילו מקורות יגיע הכסף בכל חודש, ומה ממנו פטור.">
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
      <Section n="03" id="p-assume" title="על מה התחזית מבוססת?" lead="כל מספר כאן ניתן לשינוי, והתחזית מתעדכנת מיד ונשמרת במכשיר.">
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
      <NextSteps items={[
        ...(!hasBalances ? [{ text: 'להעתיק מהדוח השנתי של כל קרן את הצבירה של היום, לשדות למעלה. בלי זה התחזית נמוכה מהאמת.', light: 'red' as const, action: { label: 'לשדות', onClick: () => document.getElementById('p-assume')?.scrollIntoView({ behavior: 'smooth' }) } }] : []),
        { text: 'לאמת את גיל הפרישה בסימולטור של ביטוח לאומי.', light: 'amber' },
        { text: 'לבדוק בתקנון הקרן את מקדם ההמרה לגיל שלך, ולעדכן כאן.', light: 'amber' },
      ]} />
    </div>
  );
}

/* ---------- Time planning ---------- */
export function Time({ slips, params, go, onSlip }: P) {
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
      <Section n="01" title="כמה שווה עוד שנת עבודה?" lead="אותן הנחות של דף הפנסיה, בגילי פרישה שונים. המקדם עולה בכ-8 לכל שנה מוקדמת (**הערכה גסה**).">
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
        <Bars fmt={nis} rows={rows.map((r) => ({ label: `פרישה בגיל ${r.a}`, value: r.total, tone: r.a === params.retireAge ? 'pos' : 'save', note: r.a === params.retireAge ? 'הנבחר' : '' }))} />
        <p className="note"><M>{`כל שנת עבודה נוספת מוסיפה גם **${nis(bankAvg * 12)}** שכר לבנק, ודוחה את תחילת הקצבה בשנה.`}</M></p>
      </Section>
      <Section n="02" title="מתי צריך להחליט?" lead="המועדים שבהם החלטה עושה הבדל.">
        <ol className="timeline">
          {dates.filter((x) => x.d).sort((a, b) => a.d!.getTime() - b.d!.getTime()).map((x) => (
            <li key={x.t}><span className="tl-date">{fmtDate(x.d)}</span><b>{x.t}</b><span>{x.x}</span>{x.d && x.d > today && <i>בעוד {Math.round(monthsBetween(today, x.d) / 12 * 10) / 10} שנים</i>}</li>
          ))}
        </ol>
      </Section>
      <Section n="03" title="איך לנהל את הזמן נכון?">
        <div className="cards">
          <article className="card"><Insight title="חופשה: לנצל או לצבור" tone="amber">{`כל ${params.vacUnit === 'days' ? 'יום' : 'שעה'} שנצבר שווה היום **${nis(unitValue, 2)}**, וערכו עולה עם השכר. מעל תקרת הצבירה הוא נמחק, ולכן לנצל לפני שמגיעים אליה.`}</Insight></article>
          <article className="card"><Insight title="מועד הפרישה בתוך השנה" tone="blue">{`פדיון חופשה ומענקים בפרישה חייבים במס. **פריסה** על כמה שנות מס מקטינה אותו; לבדוק עם יועץ מס לפני שקובעים תאריך.`}</Insight></article>
          <article className="card"><Insight title="השתלמות: לא למשוך כשנפתחת" tone="green">{`קרן נזילה ממשיכה לצבור **פטור ממס** על הרווחים. משיכה רק כשיש לכסף שימוש טוב יותר.`}</Insight></article>
          <article className="card"><Insight title="פעם בשנה: הדוח השנתי" tone="blue">{`כשמגיע הדוח השנתי מהקרנות, לעדכן כאן את **הצבירה** ואת **דמי הניהול**. התחזית מתעדכנת מיד.`}</Insight></article>
        </div>
      </Section>
      <NextSteps items={[
        { text: 'לפני סוף השנה: תרומות והפקדות עצמאיות, כדי שייכנסו לשנת המס הזאת.', light: 'amber' },
        { text: 'לקבוע גיל פרישה מועדף בדף הפנסיה, ולראות כאן מה כל שנה מוסיפה.', light: 'green', action: { label: 'לדף הפנסיה', onClick: () => go('pension') } },
      ]} />
    </div>
  );
}

/* ---------- How it is calculated (MOKED106: "איך מודדים") ---------- */
export function Method({ slips, params, go }: P) {
  const ok = slips.filter((s) => !s.warnings.length);
  const bad = slips.filter((s) => s.warnings.length);
  const last = slips[slips.length - 1];
  return (
    <div>
      <Section n="01" title="האם כל תלוש נקרא נכון?" lead={slips.length ? `**${ok.length} מתוך ${slips.length}** תלושים עברו בדיקת התאמה מלאה.` : 'עוד אין תלושים.'}>
        {slips.length > 0 && <Meter label="תלושים שעברו בדיקת התאמה" value={(ok.length / slips.length) * 100} target={100} max={100} fmt={(n) => `${Math.round(n)}%`} />}
        {bad.map((s) => (
          <Insight key={s.id} title={`${monthLabel(s)}: לבדיקה`} tone="red">{s.warnings.join(' ')}</Insight>
        ))}
        {bad.length > 0 && <p className="note">אפשר לפתוח את החודש בדף "מה יש בתלוש" ולהשוות למסמך המקורי.</p>}
        <dl className="method">
          <dt>מה נבדק</dt>
          <dd>בכל תלוש: סכום שורות התשלום שווה ל"סך תשלומים", סכום ניכויי החובה שווה לסיכום שלהם, וסכום ההפקדות לקופות שווה ל"ניכויי חו"ז". תלוש שלא עובר מסומן במפה ובדף הזה.</dd>
        </dl>
      </Section>
      <Section n="02" title="מאיפה כל מספר מגיע?">
        <dl className="method">
          <dt>מקור הנתונים</dt>
          <dd>קובצי ה-PDF של מלם שכר, כפי שהעלית אותם. הטקסט נקרא לפי המיקום שלו בדף: שורת הסיכום, טבלת התשלומים והניכויים, ו"נתונים אישיים" בצד.</dd>
          <dt>לבנק</dt>
          <dd>"סכום בבנק" בתחתית התלוש: נטו פחות ניכויים אישיים ופחות החלק שלך בפנסיה ובהשתלמות.</dd>
          <dt>המעסיק מפקיד</dt>
          <dd>הפרשות המעסיק ל"תגמולים" ול"פיצויים" מתוך "נתוני עזר". הן לא חלק מהברוטו, ולכן מוצגות בנפרד.</dd>
          <dt>שווי שנזקף</dt>
          <dd>רכב צמוד, טלפון, הטבות ועד והשתלמות מעל התקרה. המס עליהם מחושב לפי המס השולי שבתלוש.</dd>
          <dt>יתרות</dt>
          <dd>חופשה ומחלה כפי שבתלוש. התלוש לא כותב את היחידה; בחרת: {params.vacUnit === 'days' ? 'ימים' : 'שעות'}.</dd>
        </dl>
      </Section>
      <Section n="03" title="מה הוא חישוב ומה הוא הערכה?" lead="כל מה שמסומן **הערכה** תלוי בהנחות; כל השאר מועתק מהתלוש.">
        <dl className="method">
          <dt>מועתק מהתלוש</dt>
          <dd>ברוטו, ניכויים, לבנק, הפקדות, יתרות, נקודות זיכוי, מס שולי ומצטברים.</dd>
          <dt>הערכה</dt>
          <dd>{`קצבה: תשואה ריאלית ${n2(params.realReturn)}%, דמי ניהול ${n2(params.feeBalance)}% מהצבירה ו-${n2(params.feeDeposit)}% מההפקדה, מקדם ${params.coefficient}, גיל פרישה ${params.retireAge}, פטור ${params.exemptPct}% מתקרה של ${nis(params.exemptCeiling)}, קצבת זקנה ${nis(params.oldAge)}. מס: מדרגות 2026, נקודת זיכוי ${nis(params.pointValue)}.`}</dd>
          <dt>שינוי הנחה</dt>
          <dd><button type="button" className="btn" onClick={() => go('pension')}>לשינוי ההנחות בדף הפנסיה</button></dd>
        </dl>
      </Section>
      <Section n="04" title="מי רואה את הנתונים?">
        <dl className="method">
          <dt>פרטיות</dt>
          <dd>הקבצים נקראים בתוך הדפדפן ונשמרים רק במכשיר הזה. אין שרת, אין חשבון, אין שליחה לבינה מלאכותית. מעבר למכשיר אחר: גיבוי לקובץ מתפריט A&I.</dd>
          <dt>מה האפליקציה לא עושה</dt>
          <dd>היא לא ייעוץ פנסיוני או ייעוץ מס, ולא מחליפה את הדוח השנתי של הקרנות. היא מראה מה כתוב בתלוש ומה כדאי לבדוק.</dd>
          <dt>עדכון אחרון</dt>
          <dd>{last ? `התלוש האחרון: ${monthLabel(last)}.` : '—'}</dd>
        </dl>
      </Section>
    </div>
  );
}

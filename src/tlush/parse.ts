import type { Balance, Row, Slip } from './types';

/** A text item from pdf.js with its position (x grows left to right, y grows bottom to top). */
export interface Item { x: number; y: number; s: string; page: number }

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const NUM = /^-?[\d,]+(\.\d+)?-?$/;
const isNum = (s: string) => NUM.test(s.trim());
const num = (s: string) => {
  const t = s.trim().replace(/,/g, '');
  return t.endsWith('-') ? -parseFloat(t.slice(0, -1)) : parseFloat(t);
};
const near = (a: number, b: number, d = 4) => Math.abs(a - b) <= d;

/** Summary bar at the foot of the slip: header label -> field. */
const SUMMARY: Record<string, keyof Slip['summary']> = {
  'שכר בסיס': 'base', 'תוספות': 'additions', 'עבודה נוספת': 'overtime', 'החזר הוצאות': 'expenses',
  "תש' אחרים": 'otherPay', 'ברוטו שוטף': 'gross', 'הפרשים': 'diffs', 'סך תשלומים': 'totalPay',
  'ניכויי חובה': 'mandatory', 'שכר נטו': 'net', 'ניכויי משרד': 'personalDed', 'ניכויי חו"ז': 'fundsDed', 'סכום בבנק': 'bank',
};

const CUMULATIVE: [string, keyof Slip['cumulative']][] = [
  ['ברוטו למס הכנסה', 'grossTax'], ['זיכוי חסכון', 'savingCredit'], ['מס הכנסה שנתי', 'annualTax'],
  ['סך הפרשה לפנסיה', 'pension'], ['סך הפרשה לקה"ש', 'hishtalmut'], ['סך הפרשה לתגמולים', 'tagmulim'],
];

/** Reads a Malam payroll slip ("מלם שכר") from its positioned text items. Pure: no pdf.js here, so it is testable. */
export function parseItems(all: Item[]): Slip {
  const warnings: string[] = [];
  const items = all.map((i) => ({ ...i, s: i.s.trim() })).filter((i) => i.s);
  // Only pages with the detail table ("פירוט תשלומים וניכויים") matter; the message pages repeat the header.
  const detailPages = new Set(items.filter((i) => i.s.includes('פירוט תשלומים')).map((i) => i.page));
  const det = items.filter((i) => detailPages.has(i.page));
  if (!det.length) throw new Error('לא נמצא בקובץ דף "פירוט תשלומים וניכויים". זה תלוש של מלם שכר?');
  const firstPage = Math.min(...detailPages);

  // Month and year: "מאי 2026"
  let year = 0, month = 0;
  for (const i of det) {
    const m = i.s.match(new RegExp(`(${MONTHS.join('|')})\\s+(20\\d\\d)`));
    if (m) { month = MONTHS.indexOf(m[1]) + 1; year = +m[2]; break; }
  }
  if (!month) throw new Error('לא נמצא חודש התלוש (למשל "מאי 2026").');

  const p1 = det.filter((i) => i.page === firstPage);

  // Summary bar: numbers on the row just under the labels, matched by x.
  const summary = Object.fromEntries(Object.values(SUMMARY).map((k) => [k, 0])) as Slip['summary'];
  const labels = p1.filter((i) => SUMMARY[i.s] && i.y < 120);
  if (labels.length >= 8) {
    const ly = Math.min(...labels.map((l) => l.y));
    const nums = p1.filter((i) => isNum(i.s) && i.y < ly && i.y > ly - 40);
    for (const l of labels) {
      const best = nums.reduce<Item | null>((b, n) => (!b || Math.abs(n.x - l.x) < Math.abs(b.x - l.x) ? n : b), null);
      if (best && Math.abs(best.x - l.x) < 25) summary[SUMMARY[l.s]] = num(best.s);
    }
  } else warnings.push('שורת הסיכום בתחתית התלוש לא נקראה.');

  // Two columns: personal panel on the right (x >= 415), detail table on the left.
  const left = det.filter((i) => i.x < 415);
  const right = det.filter((i) => i.x >= 415);

  // Detail table: sections are "- name -" headers; rows start with a numeric code near x 390-410.
  const payments: Row[] = [], mandatory: Row[] = [], personal: Row[] = [], funds: Row[] = [];
  for (const page of detailPages) {
    const L = left.filter((i) => i.page === page);
    const heads = L.filter((i) => /^-\s*.+\s*-$/.test(i.s)).sort((a, b) => b.y - a.y);
    const codes = L.filter((i) => /^\d{1,6}$/.test(i.s) && i.x > 380 && i.x < 412 && i.y < 730);
    for (const c of codes) {
      const head = heads.filter((h) => h.y > c.y).sort((a, b) => a.y - b.y)[0];
      if (!head) continue;
      const section = head.s.replace(/^-\s*|\s*-$/g, '').trim();
      const line = L.filter((i) => near(i.y, c.y, 2) && i !== c);
      const name = line.filter((i) => !isNum(i.s) && !/^\d\d\/\d\d$/.test(i.s)).sort((a, b) => b.x - a.x).map((i) => i.s).join(' ');
      const ns = line.filter((i) => isNum(i.s) && i.x > 95).sort((a, b) => a.x - b.x);
      if (!ns.length) continue;
      const row: Row = { code: c.s, name, amount: num(ns[0].s), section };
      if (section.includes('גמל')) {
        const pct = ns.find((n) => n.x > 250 && n.x < 290);
        const base = ns.find((n) => n.x > 185 && n.x < 235);
        if (pct) row.pct = num(pct.s);
        if (base) row.base = num(base.s);
        funds.push(row);
      } else if (section.includes('חובה')) mandatory.push(row);
      else if (section.includes('ניכו')) personal.push(row);
      else {
        const qty = ns.find((n) => n.x > 280 && n.x < 300);
        const rate = ns.find((n) => n.x > 220 && n.x < 260);
        if (qty) row.qty = num(qty.s);
        if (rate) row.rate = num(rate.s);
        payments.push(row);
      }
    }
  }
  if (!payments.length) warnings.push('לא נקראו שורות תשלום.');

  // Right panel, first detail page.
  const R = right.filter((i) => i.page === firstPage);
  const valueLeftOf = (label: string, minX = 425) => {
    const l = R.find((i) => i.s.startsWith(label));
    if (!l) return undefined;
    return R.filter((i) => near(i.y, l.y, 2) && i.x < l.x && i.x >= minX && i !== l).sort((a, b) => b.x - a.x)[0]?.s;
  };
  const toNum = (s?: string) => (s && isNum(s) ? num(s) : undefined);
  const info: Slip['info'] = {
    creditPoints: toNum(valueLeftOf('סך נקודות זיכוי')),
    marginalTax: toNum(valueLeftOf('% מס שולי')),
    birthDate: valueLeftOf('תאריך לידה'),
    startDate: valueLeftOf('תאריך תחילת העסקה'),
    family: valueLeftOf('מצב משפחתי'),
    spouse: valueLeftOf('עבודת בן זוג'),
    rank: valueLeftOf('דרוג', 470) ? R.filter((i) => { const l = R.find((r) => r.s.startsWith('דרוג')); return l && near(i.y, l.y, 2) && i.x < l.x; }).sort((a, b) => b.x - a.x).map((i) => i.s).join(' ') : undefined,
  };

  // "נתוני עזר": code at x ~575, name, value, percent.
  const aux: Row[] = [];
  const auxHead = R.find((i) => i.s.includes('נתוני עזר'));
  const vacHead = R.find((i) => i.s === 'י.פתיחה');
  if (auxHead) {
    const bottom = vacHead ? vacHead.y : 0;
    for (const c of R.filter((i) => /^\d{1,6}$/.test(i.s) && i.x > 565 && i.y < auxHead.y && i.y > bottom)) {
      const line = R.filter((i) => near(i.y, c.y, 2) && i !== c);
      const name = line.filter((i) => !isNum(i.s)).map((i) => i.s).join(' ');
      const ns = line.filter((i) => isNum(i.s)).sort((a, b) => b.x - a.x);
      if (!ns.length) continue;
      const row: Row = { code: c.s, name, amount: num(ns[0].s), section: 'נתוני עזר' };
      if (ns[1] && ns[1].x > 445) row.pct = num(ns[1].s);
      aux.push(row);
      if (name.includes('ערך שעה')) { info.hourValue = row.amount; if (ns[1]) info.dayValue = num(ns[ns.length - 1].s); }
    }
  }

  // Vacation and sick balances: columns matched to their headers by x.
  const balance = (label: string): Balance | undefined => {
    const l = R.find((i) => i.s === label);
    if (!l || !vacHead) return undefined;
    const cols = R.filter((i) => near(i.y, vacHead.y, 2) && !isNum(i.s));
    const pick = (h: string) => {
      const c = cols.find((i) => i.s.includes(h));
      const v = c && R.find((i) => near(i.y, l.y, 2) && isNum(i.s) && Math.abs(i.x - c.x) < 14);
      return v ? num(v.s) : 0;
    };
    return { open: pick('פתיחה'), credit: pick('זיכוי'), used: pick('ניצול'), close: pick('סגירה') };
  };

  const cumulative: Slip['cumulative'] = {};
  for (const [label, key] of CUMULATIVE) {
    const l = R.find((i) => i.s.startsWith(label));
    if (!l) continue;
    const v = R.filter((i) => near(i.y, l.y, 3) && isNum(i.s) && i.x < l.x).sort((a, b) => b.x - a.x)[0];
    if (v) cumulative[key] = num(v.s);
  }

  const slipNo = p1.find((i) => i.s === 'תלוש:') ? p1.filter((i) => isNum(i.s) && near(i.y, p1.find((j) => j.s === 'תלוש:')!.y, 3) && i.x < p1.find((j) => j.s === 'תלוש:')!.x).sort((a, b) => b.x - a.x)[0]?.s : undefined;

  // Sanity: the lines must add up to the summary.
  const sum = (rs: Row[]) => Math.round(rs.reduce((a, r) => a + r.amount, 0) * 100) / 100;
  if (summary.totalPay && Math.abs(sum(payments) - summary.totalPay) > 1) warnings.push(`סכום שורות התשלום (${sum(payments)}) שונה מסך התשלומים (${summary.totalPay}).`);
  if (summary.mandatory && Math.abs(sum(mandatory) - summary.mandatory) > 1) warnings.push('סכום ניכויי החובה לא תואם לסיכום.');
  if (summary.fundsDed && Math.abs(sum(funds) - summary.fundsDed) > 1) warnings.push('סכום ההפקדות לקופות לא תואם לסיכום.');

  return {
    id: `${year}-${String(month).padStart(2, '0')}`, year, month, slipNo,
    summary, payments, mandatory, personal, funds, aux, info,
    vacation: balance('חופשה'), sick: balance('מחלה'), cumulative, warnings,
  };
}

export const MONTH_NAMES = MONTHS;

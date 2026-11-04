import type { Row, Slip } from './types';

export const r0 = (n: number) => Math.round(n);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

export type FundKind = 'pension' | 'hishtalmut';
export interface FundGroup {
  key: string;
  name: string;
  kind: FundKind;
  employee: number;
  employer: number;
  severance: number;
  base: number;
  pctEmployee?: number;
  pctEmployer?: number;
  pctSeverance?: number;
}

/** Readable fund names: the slip cuts them at 15 characters. */
export function fundName(raw: string): string {
  if (/קה"ש|השתלמ/.test(raw)) return /מגדל/.test(raw) ? 'קרן השתלמות מגדל' : 'קרן השתלמות';
  if (/מבטחים/.test(raw) && !/מנורה/.test(raw)) return 'מבטחים החדשה (פנסיה)';
  if (/מנורה/.test(raw)) return 'מנורה מבטחים (פנסיה)';
  if (/מגדל ה\.הוצ/.test(raw)) return 'מגדל, על החזר הוצאות';
  return raw;
}

/** Employee fund rows + the employer rows in "נתוני עזר" share a code prefix (33671 / 33672 / 33673). */
export function fundGroups(s: Slip): FundGroup[] {
  const groups = new Map<string, FundGroup>();
  for (const f of s.funds) {
    const key = f.code.slice(0, -1);
    const kind: FundKind = /קה"ש|השתלמ/.test(f.name) ? 'hishtalmut' : 'pension';
    groups.set(key, { key, name: fundName(f.name), kind, employee: f.amount, employer: 0, severance: 0, base: f.base ?? 0, pctEmployee: f.pct });
  }
  for (const a of s.aux) {
    if (!/הפרש|פיצ/.test(a.name)) continue;
    const g = groups.get(a.code.slice(0, -1));
    if (!g) continue;
    if (/פיצ/.test(a.name)) { g.severance += a.amount; g.pctSeverance = a.pct; } else { g.employer += a.amount; g.pctEmployer = a.pct; }
  }
  return [...groups.values()];
}

export const employerTotal = (s: Slip) => sum(fundGroups(s).map((g) => g.employer + g.severance));

/** Values that are taxed but never paid in cash (car, phone, benefits, study fund over the ceiling). */
export function imputed(s: Slip): Row[] {
  return s.aux.filter((a) => /רכב|רט"ן|הטבות|זקיפת/.test(a.name) && a.amount > 0);
}

export const mandatoryBy = (s: Slip, word: string) => sum(s.mandatory.filter((m) => m.name.includes(word)).map((m) => m.amount));

/** Monthly income tax 2026 (brackets frozen at the 2025 values), before credit points. Estimate. */
export const BRACKETS: [number, number][] = [[7010, 0.1], [10060, 0.14], [16150, 0.2], [22440, 0.31], [46690, 0.35], [60130, 0.47], [Infinity, 0.5]];
export function taxBeforeCredit(monthly: number): number {
  let t = 0, prev = 0;
  for (const [top, rate] of BRACKETS) {
    if (monthly <= prev) break;
    t += (Math.min(monthly, top) - prev) * rate;
    prev = top;
  }
  return t;
}

export interface Params {
  retireAge: number;
  realReturn: number;
  feeBalance: number;
  feeDeposit: number;
  coefficient: number;
  /** Current balance per pension fund key, from the annual report. */
  balances: Record<string, number>;
  hishtalmutBalance: number;
  salaryGrowth: number;
  pointValue: number;
  pointsAtRetirement: number;
  exemptCeiling: number;
  exemptPct: number;
  oldAge: number;
  targetFee: number;
  /** Units of the vacation and sick balances on the slip. */
  vacUnit: 'days' | 'hours';
  donation: number;
}

export const DEFAULTS: Params = {
  retireAge: 65, realReturn: 3, feeBalance: 0.3, feeDeposit: 1.5, coefficient: 205,
  balances: {}, hishtalmutBalance: 0, salaryGrowth: 0.5, pointValue: 242, pointsAtRetirement: 2.75,
  exemptCeiling: 9430, exemptPct: 67, oldAge: 1800, targetFee: 0.15, vacUnit: 'days', donation: 0,
};

export function parseDate(d?: string): Date | null {
  const m = d?.match(/(\d\d)\/(\d\d)\/(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

export const monthsBetween = (a: Date, b: Date) => Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());

/** Grows a balance month by month: real return minus the fee on the balance, deposits minus the fee on deposits. */
export function grow(balance: number, monthlyDeposit: number, months: number, p: Pick<Params, 'realReturn' | 'feeBalance' | 'feeDeposit' | 'salaryGrowth'>): number {
  const r = (p.realReturn - p.feeBalance) / 100 / 12;
  const g = p.salaryGrowth / 100 / 12;
  let b = balance, dep = monthlyDeposit;
  for (let i = 0; i < months; i++) { b = b * (1 + r) + dep * (1 - p.feeDeposit / 100); dep *= 1 + g; }
  return b;
}

export interface Forecast {
  retireDate: Date | null;
  months: number;
  funds: { key: string; name: string; deposit: number; balanceNow: number; balance: number; pension: number }[];
  pension: number;
  exempt: number;
  tax: number;
  net: number;
  hishtalmut: number;
  oldAge: number;
  totalNet: number;
}

/** Average monthly deposit per group over the loaded months. */
export function avgGroups(slips: Slip[]): FundGroup[] {
  const map = new Map<string, FundGroup & { n: number }>();
  for (const s of slips) for (const g of fundGroups(s)) {
    const m = map.get(g.key);
    if (!m) map.set(g.key, { ...g, n: 1 });
    else { m.employee += g.employee; m.employer += g.employer; m.severance += g.severance; m.base += g.base; m.n++; }
  }
  return [...map.values()].map(({ n, ...g }) => ({ ...g, employee: g.employee / n, employer: g.employer / n, severance: g.severance / n, base: g.base / n }));
}

export function pensionTax(pension: number, p: Params) {
  const exempt = Math.min(pension, (p.exemptCeiling * p.exemptPct) / 100);
  const tax = Math.max(0, taxBeforeCredit(pension - exempt) - p.pointsAtRetirement * p.pointValue);
  return { exempt, tax };
}

export function forecast(slips: Slip[], p: Params, retireAge = p.retireAge, coefficient = p.coefficient): Forecast {
  const last = slips[slips.length - 1];
  const birth = parseDate(last?.info.birthDate);
  const retireDate = birth ? new Date(birth.getFullYear() + Math.floor(retireAge), birth.getMonth() + Math.round((retireAge % 1) * 12), 1) : null;
  const from = last ? new Date(last.year, last.month, 1) : new Date();
  const months = retireDate ? monthsBetween(from, retireDate) : 0;
  const groups = avgGroups(slips);
  const funds = groups.filter((g) => g.kind === 'pension').map((g) => {
    const deposit = g.employee + g.employer + g.severance;
    const balanceNow = p.balances[g.key] ?? 0;
    const balance = grow(balanceNow, deposit, months, p);
    return { key: g.key, name: g.name, deposit, balanceNow, balance, pension: balance / coefficient };
  });
  const pension = sum(funds.map((f) => f.pension));
  const { exempt, tax } = pensionTax(pension, p);
  const hDep = sum(groups.filter((g) => g.kind === 'hishtalmut').map((g) => g.employee + g.employer));
  const hishtalmut = grow(p.hishtalmutBalance, hDep, months, p);
  return { retireDate, months, funds, pension, exempt, tax, net: pension - tax, hishtalmut, oldAge: p.oldAge, totalNet: pension - tax + p.oldAge };
}

export const nis = (n: number, d = 0) => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ₪';
export const n2 = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 2 });

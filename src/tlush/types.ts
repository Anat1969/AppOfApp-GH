/** One payslip line: a payment, a deduction or a fund deposit. */
export interface Row {
  code: string;
  name: string;
  amount: number;
  /** Section on the slip: base, additions, expenses... */
  section: string;
  pct?: number;
  base?: number;
  qty?: number;
  rate?: number;
}

export interface Balance { open: number; credit: number; used: number; close: number }

export interface Slip {
  /** YYYY-MM */
  id: string;
  year: number;
  month: number;
  slipNo?: string;
  fileName?: string;
  summary: {
    base: number; additions: number; overtime: number; expenses: number; otherPay: number;
    gross: number; diffs: number; totalPay: number; mandatory: number; net: number;
    personalDed: number; fundsDed: number; bank: number;
  };
  payments: Row[];
  mandatory: Row[];
  personal: Row[];
  funds: Row[];
  /** Employer deposits and imputed values from "נתוני עזר". */
  aux: Row[];
  info: {
    creditPoints?: number; marginalTax?: number; birthDate?: string; startDate?: string;
    family?: string; spouse?: string; rank?: string; grade?: string; dayValue?: number; hourValue?: number;
  };
  vacation?: Balance;
  sick?: Balance;
  cumulative: { grossTax?: number; savingCredit?: number; annualTax?: number; pension?: number; hishtalmut?: number; tagmulim?: number };
  warnings: string[];
}

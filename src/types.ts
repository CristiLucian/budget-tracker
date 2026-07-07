export type Category = {
  id: string; // slug, e.g. "alimente"
  name: string; // display, e.g. "Alimente"
  order: number;
  archived: boolean; // hidden from quick-add, kept for history
  // Money set aside, not really spent (e.g. "Fond economii"). It still
  // counts toward "Buget cheltuit" on the Dashboard (money that left the
  // available budget) but is excluded from spending statistics.
  isSavings?: boolean;
};

export type Transaction = {
  id: string; // uuid
  categoryId: string;
  amount: number; // positive, RON
  note?: string;
  timestamp: string; // ISO datetime
};

export type Period = {
  id: string; // e.g. "2026-06"
  name: string; // e.g. "Iunie 2026"
  start: string; // ISO date, e.g. "2026-06-07"
  end: string; // start of next period (exclusive)
  budgetAvailable: number; // base income for the period (salariu)
  extraIncome?: number; // other income (alte venituri)
  // Opt-in carry-over: when true, this period's opening balance is the
  // previous period's closing balance (computed, always in sync).
  carryEnabled?: boolean;
  /** @deprecated manual carry amount; migrated to carryEnabled by normalizeState */
  carryIn?: number;
  transactions: Transaction[];
};

export type Settings = {
  monthStartDay: number; // default 7; periods run 7th -> 7th
  currency: "RON";
  categories: Category[];
};

export type AppState = {
  settings: Settings;
  periods: Period[];
};

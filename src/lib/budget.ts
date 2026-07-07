import type { AppState, Period } from "../types";
import { sumAmounts } from "./money";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Real income of a period: salariu + alte venituri. The carry-over is NOT
 * income — it's last month's leftover changing pockets (an opening balance),
 * so it must never inflate income-based statistics.
 */
export function actualIncome(p: Period): number {
  return round2((p.budgetAvailable || 0) + (p.extraIncome || 0));
}

export type PeriodBalance = {
  /** Opening balance taken from the previous period (0 when carry is off). */
  carryIn: number;
  /** Money usable this period: actualIncome + carryIn. */
  available: number;
  /** Closing balance: available − all outflows (incl. savings). Can be negative. */
  leftover: number;
  /** Name of the next period that carries this leftover in, if any. */
  carriedTo?: string;
};

/**
 * Running balances for every period, like a bank statement: when a period
 * has carryEnabled, its opening balance is exactly the previous period's
 * closing balance. Because everything is computed from transactions, editing
 * a past month propagates forward automatically — the chain can't desync.
 */
export function computeBalances(state: AppState): Map<string, PeriodBalance> {
  const sorted = [...state.periods].sort((a, b) => a.start.localeCompare(b.start));
  const map = new Map<string, PeriodBalance>();
  let prev: { period: Period; balance: PeriodBalance } | null = null;
  for (const p of sorted) {
    const carryIn = p.carryEnabled && prev ? prev.balance.leftover : 0;
    const available = round2(actualIncome(p) + carryIn);
    const leftover = round2(available - sumAmounts(p.transactions));
    const balance: PeriodBalance = { carryIn, available, leftover };
    if (p.carryEnabled && prev) prev.balance.carriedTo = p.name;
    map.set(p.id, balance);
    prev = { period: p, balance };
  }
  return map;
}

/** Balance of a single period (convenience over computeBalances). */
export function periodBalance(state: AppState, periodId: string): PeriodBalance {
  return (
    computeBalances(state).get(periodId) ?? { carryIn: 0, available: 0, leftover: 0 }
  );
}

/**
 * The period right before `periodId` (chronologically) and its closing
 * balance — what the carry-over toggle in the budget editor would bring in.
 * Returns null when there is no earlier period.
 */
export function previousBalance(
  state: AppState,
  periodId: string
): { period: Period; leftover: number } | null {
  const sorted = [...state.periods].sort((a, b) => a.start.localeCompare(b.start));
  const idx = sorted.findIndex((p) => p.id === periodId);
  if (idx <= 0) return null;
  const prev = sorted[idx - 1];
  return { period: prev, leftover: periodBalance(state, prev.id).leftover };
}

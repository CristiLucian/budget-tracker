import type { AppState, Period } from "../types";
import { sumAmounts } from "./money";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Total money available in a period:
 *   salariu (budgetAvailable) + alte venituri (extraIncome) + report (carryIn)
 */
export function effectiveIncome(p: Period): number {
  return round2((p.budgetAvailable || 0) + (p.extraIncome || 0) + (p.carryIn || 0));
}

/** What's left after all spending (incl. savings) — the amount you could roll over. */
export function periodLeftover(p: Period): number {
  return round2(effectiveIncome(p) - sumAmounts(p.transactions));
}

/**
 * Leftover of the period immediately before `periodId` (chronologically) —
 * the value suggested when the user chooses to carry money into a month.
 * Returns 0 when there is no earlier period.
 */
export function suggestedCarryIn(state: AppState, periodId: string): number {
  const sorted = [...state.periods].sort((a, b) => a.start.localeCompare(b.start));
  const idx = sorted.findIndex((p) => p.id === periodId);
  if (idx <= 0) return 0;
  return periodLeftover(sorted[idx - 1]);
}

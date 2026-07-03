import type { AppState } from "../types";
import { sumAmounts } from "./money";

/**
 * When carry-over is enabled, each period's leftover (rămas) rolls into the
 * next period. Returns a map periodId -> amount carried IN from the prior
 * period (0 for the first, and 0 everywhere when the setting is off).
 * Fully derived — budgetAvailable is never mutated, so toggling is reversible.
 */
export function carryInByPeriod(state: AppState): Map<string, number> {
  const map = new Map<string, number>();
  const sorted = [...state.periods].sort((a, b) => a.start.localeCompare(b.start));
  if (!state.settings.carryOver) {
    for (const p of sorted) map.set(p.id, 0);
    return map;
  }
  let leftover = 0;
  for (const p of sorted) {
    map.set(p.id, Math.round(leftover * 100) / 100);
    const effective = p.budgetAvailable + leftover;
    leftover = effective - sumAmounts(p.transactions);
  }
  return map;
}

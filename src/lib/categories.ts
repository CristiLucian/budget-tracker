import type { AppState, Category, Transaction } from "../types";

/**
 * Savings categories hold money you keep, not money you spend (e.g.
 * "Fond economii"). Existing accounts have no flag on the category, so we
 * fall back to the default savings category id from the seed.
 */
export function isSavingsCategory(c: Category): boolean {
  return c.isSavings ?? c.id === "fond-economii";
}

export function savingsIdSet(state: AppState): Set<string> {
  return new Set(state.settings.categories.filter(isSavingsCategory).map((c) => c.id));
}

function sumCents(txs: Transaction[]): number {
  return txs.reduce((s, t) => s + Math.round(t.amount * 100), 0);
}

/** Real spending: everything except savings categories. */
export function spendingOf(txs: Transaction[], savingsIds: Set<string>): number {
  return sumCents(txs.filter((t) => !savingsIds.has(t.categoryId))) / 100;
}

/** Money set aside into savings categories this period. */
export function savingsOf(txs: Transaction[], savingsIds: Set<string>): number {
  return sumCents(txs.filter((t) => savingsIds.has(t.categoryId))) / 100;
}

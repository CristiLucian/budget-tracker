import type { Transaction } from "../types";

/** Compact Romanian date for transaction rows: 07.06 */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
}

/**
 * Newest first. Compares real instants (robust to mixed ISO precision, e.g.
 * hand-edited backups without milliseconds); same-instant entries keep the
 * most recently added on top.
 */
export function sortNewestFirst(transactions: Transaction[]): Transaction[] {
  return transactions
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const diff = Date.parse(b.t.timestamp) - Date.parse(a.t.timestamp);
      if (!Number.isNaN(diff) && diff !== 0) return diff;
      const cmp = b.t.timestamp.localeCompare(a.t.timestamp);
      return cmp !== 0 ? cmp : b.i - a.i;
    })
    .map(({ t }) => t);
}

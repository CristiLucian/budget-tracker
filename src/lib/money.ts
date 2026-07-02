import type { Transaction } from "../types";

const fmt = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** Romanian display format: 1.234,56 lei */
export function formatLei(amount: number): string {
  return `${fmt.format(amount)} lei`;
}

export function formatNumber(amount: number): string {
  return fmt.format(amount);
}

/** Sum in integer bani to avoid float drift, returned as lei. */
export function sumAmounts(transactions: Transaction[]): number {
  const cents = transactions.reduce((s, t) => s + Math.round(t.amount * 100), 0);
  return cents / 100;
}

/**
 * Parse user input with comma or dot as decimal separator.
 * "12,5" -> 12.5, "1.234,56" -> 1234.56, "12.5" -> 12.5
 * Returns null when invalid or not strictly positive.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    // comma is the decimal separator; dots are thousands separators
    s = s.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

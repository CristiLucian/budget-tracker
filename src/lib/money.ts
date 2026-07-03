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
 * Force a single, comma-decimal display while typing. Converts any dot the
 * keyboard produces into a comma and keeps only the first comma, so the
 * value the user sees always matches the Romanian format. Digits/comma only.
 */
export function sanitizeAmountInput(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const first = s.indexOf(",");
  if (first !== -1) {
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/,/g, "");
  }
  return s;
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

/**
 * Parse a money field that may be empty (-> 0) and, if allowed, negative
 * (used for income components and the carry-over amount). Returns null only
 * when the text is genuinely unparseable.
 */
export function parseMoney(input: string, allowNegative = false): number | null {
  let s = input.trim().replace(/\s/g, "");
  if (!s || s === "-") return 0;
  let sign = 1;
  if (s.startsWith("-")) {
    if (!allowNegative) return null;
    sign = -1;
    s = s.slice(1);
  }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return (sign * Math.round(n * 100)) / 100;
}

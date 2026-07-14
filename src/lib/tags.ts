import type { Transaction } from "../types";

/** Case- and diacritic-insensitive text for grouping and matching. */
export function fold(s: string): string {
  const NFD = s.toLowerCase().normalize("NFD");
  return NFD.replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

/** Trim, drop empties, dedupe case/diacritic-insensitively (first spelling wins). */
export function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const tag = r.trim();
    if (!tag) continue;
    const key = fold(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Tags of a transaction, tolerating unmigrated data where `note` is still set. */
export function tagsOf(t: Transaction): string[] {
  if (t.tags && t.tags.length > 0) return t.tags;
  const note = t.note?.trim();
  return note ? [note] : [];
}

/** Tags joined for one-line display: "Carrefour · Mezeluri". */
export function formatTags(t: Transaction): string {
  return tagsOf(t).join(" · ");
}

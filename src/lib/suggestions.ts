import type { AppState } from "../types";
import { fold, tagsOf } from "./tags";

export { fold } from "./tags";

type TagStats = {
  display: string; // casing of the most recent use
  count: number; // uses across all categories
  countCat: number; // uses in the selected category
  lastUsed: number; // epoch ms, any category
  lastUsedCat: number; // epoch ms, selected category
  amountsCat: number[]; // amounts of same-category transactions
  amountsAll: number[];
};

/**
 * Tag suggestions for the transaction form, from the user's own history.
 * With nothing typed, only tags already used in the selected category are
 * offered, ranked by how often and how recently they were used there,
 * boosted when the typed amount is close to the amounts historically paired
 * with that tag. Once the user types, tags from every category match too
 * (stores like "Carrefour" span categories), with same-category uses still
 * ranked higher. Tags already attached to the transaction are excluded.
 */
export function suggestTags(
  state: AppState,
  categoryId: string,
  amount: number | null,
  typed: string,
  selected: string[] = [],
  limit = 5,
  now = Date.now()
): string[] {
  const byTag = new Map<string, TagStats>();
  for (const p of state.periods) {
    for (const t of p.transactions) {
      const inCategory = t.categoryId === categoryId;
      const ts = Date.parse(t.timestamp) || 0;
      for (const tag of tagsOf(t)) {
        const key = fold(tag.trim());
        if (!key) continue;
        const e =
          byTag.get(key) ??
          ({
            display: tag,
            count: 0,
            countCat: 0,
            lastUsed: 0,
            lastUsedCat: 0,
            amountsCat: [],
            amountsAll: []
          } satisfies TagStats);
        e.count += 1;
        e.amountsAll.push(t.amount);
        if (ts >= e.lastUsed) {
          e.lastUsed = ts;
          e.display = tag.trim();
        }
        if (inCategory) {
          e.countCat += 1;
          e.amountsCat.push(t.amount);
          if (ts >= e.lastUsedCat) e.lastUsedCat = ts;
        }
        byTag.set(key, e);
      }
    }
  }

  const typedFold = fold(typed.trim());
  const selectedKeys = new Set(selected.map((s) => fold(s.trim())));

  const scored = [...byTag.entries()]
    .filter(([key, e]) => {
      if (selectedKeys.has(key)) return false;
      // Nothing typed: stay within the category. Typing opens the search
      // to tags from every category.
      return typedFold ? key.includes(typedFold) : e.countCat > 0;
    })
    .map(([key, e]) => {
      // Frequency in this category: diminishing returns so one very common
      // tag doesn't permanently bury everything else.
      let score = Math.log2(1 + e.countCat) * 2;

      // Weak global signal so cross-category matches surface while typing
      // without outranking tags actually used in this category.
      score += Math.log2(1 + e.count) * 0.5;

      // Recency in this category: fades over roughly six months.
      const ageDays = Math.max(0, (now - e.lastUsedCat) / 86_400_000);
      if (e.countCat > 0) score += Math.max(0, 2 - ageDays / 90);

      // Amount proximity: the closer the typed amount is to an amount
      // historically used with this tag, the stronger the boost.
      const amounts = e.amountsCat.length > 0 ? e.amountsCat : e.amountsAll;
      if (amount !== null && amount > 0 && amounts.length > 0) {
        const rel = Math.min(
          ...amounts.map((a) => Math.abs(amount - a) / Math.max(amount, a))
        );
        if (rel <= 0.02) score += 4;
        else if (rel <= 0.1) score += 3;
        else if (rel <= 0.25) score += 1.5;
        else if (rel <= 0.5) score += 0.5;
      }

      return { key, e, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.e.countCat - a.e.countCat ||
        b.e.count - a.e.count ||
        b.e.lastUsed - a.e.lastUsed ||
        a.key.localeCompare(b.key)
    );

  return scored.slice(0, limit).map((s) => s.e.display);
}

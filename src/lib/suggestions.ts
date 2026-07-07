import type { AppState } from "../types";

/** Case- and diacritic-insensitive text for grouping and matching. */
export function fold(s: string): string {
  const NFD = s.toLowerCase().normalize("NFD");
  return NFD.replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

type NoteStats = {
  display: string; // casing of the most recent use
  count: number;
  lastUsed: number; // epoch ms
  amounts: number[];
};

/**
 * Note suggestions for the transaction form, from the user's own history:
 * notes used before in the same category, ranked by how often and how
 * recently they were used, boosted when the typed amount is close to the
 * amounts historically paired with that note. Purely local statistics —
 * every saved transaction feeds the ranking.
 */
export function suggestNotes(
  state: AppState,
  categoryId: string,
  amount: number | null,
  typed: string,
  limit = 5,
  now = Date.now()
): string[] {
  const byNote = new Map<string, NoteStats>();
  for (const p of state.periods) {
    for (const t of p.transactions) {
      if (t.categoryId !== categoryId) continue;
      const note = t.note?.trim();
      if (!note) continue;
      const key = fold(note);
      const ts = Date.parse(t.timestamp) || 0;
      const e = byNote.get(key) ?? { display: note, count: 0, lastUsed: 0, amounts: [] };
      e.count += 1;
      e.amounts.push(t.amount);
      if (ts >= e.lastUsed) {
        e.lastUsed = ts;
        e.display = note;
      }
      byNote.set(key, e);
    }
  }

  const typedFold = fold(typed.trim());

  const scored = [...byNote.entries()]
    .filter(([key]) => !typedFold || key.includes(typedFold))
    .map(([key, e]) => {
      // Frequency: diminishing returns so one very common note doesn't
      // permanently bury everything else.
      let score = Math.log2(1 + e.count) * 2;

      // Recency: fades over roughly six months.
      const ageDays = Math.max(0, (now - e.lastUsed) / 86_400_000);
      score += Math.max(0, 2 - ageDays / 90);

      // Amount proximity: the closer the typed amount is to an amount
      // historically used with this note, the stronger the boost.
      if (amount !== null && amount > 0 && e.amounts.length > 0) {
        const rel = Math.min(
          ...e.amounts.map((a) => Math.abs(amount - a) / Math.max(amount, a))
        );
        if (rel <= 0.02) score += 4;
        else if (rel <= 0.1) score += 3;
        else if (rel <= 0.25) score += 1.5;
        else if (rel <= 0.5) score += 0.5;
      }

      return { key, display: e.display, count: e.count, lastUsed: e.lastUsed, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        b.lastUsed - a.lastUsed ||
        a.key.localeCompare(b.key)
    );

  return scored.slice(0, limit).map((s) => s.display);
}

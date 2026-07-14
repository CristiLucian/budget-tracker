import { describe, expect, it } from "vitest";
import type { AppState, Transaction } from "../types";
import { fold, normalizeTags } from "./tags";
import { suggestTags } from "./suggestions";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");

let seq = 0;
const tx = (
  categoryId: string,
  amount: number,
  tags?: string[],
  timestamp = "2026-06-10T10:00:00.000Z"
): Transaction => ({ id: `t${++seq}`, categoryId, amount, tags, timestamp });

const mkState = (transactions: Transaction[]): AppState => ({
  settings: { monthStartDay: 7, currency: "RON", categories: [] },
  periods: [
    {
      id: "2026-06",
      name: "Iunie 2026",
      start: "2026-06-07",
      end: "2026-07-07",
      budgetAvailable: 5000,
      transactions
    }
  ]
});

describe("fold", () => {
  it("ignores case and Romanian diacritics", () => {
    expect(fold("Șaormă")).toBe("saorma");
    expect(fold("KFC")).toBe(fold("kfc"));
  });
});

describe("normalizeTags", () => {
  it("trims, drops empties and dedupes case/diacritic-insensitively", () => {
    expect(normalizeTags([" Carrefour ", "", "  ", "carrefour", "Mezeluri"])).toEqual([
      "Carrefour",
      "Mezeluri"
    ]);
  });
});

describe("suggestTags", () => {
  it("suggests only tags from the selected category when nothing is typed", () => {
    const state = mkState([
      tx("fast-food", 30, ["KFC"]),
      tx("alimente", 100, ["Lidl"])
    ]);
    expect(suggestTags(state, "fast-food", null, "", [], 5, NOW)).toEqual(["KFC"]);
  });

  it("opens the search to every category once the user types", () => {
    const state = mkState([
      tx("alimente", 100, ["Carrefour"]),
      tx("fast-food", 30, ["KFC"])
    ]);
    expect(suggestTags(state, "fast-food", null, "carr", [], 5, NOW)).toEqual([
      "Carrefour"
    ]);
  });

  it("ranks same-category tags above cross-category matches while typing", () => {
    const state = mkState([
      tx("alimente", 100, ["Kaufland"]),
      tx("alimente", 100, ["Kaufland"]),
      tx("alimente", 100, ["Kaufland"]),
      tx("fast-food", 30, ["KFC"])
    ]);
    expect(suggestTags(state, "fast-food", null, "k", [], 5, NOW)[0]).toBe("KFC");
  });

  it("suggests every tag of a multi-tag transaction", () => {
    const state = mkState([tx("alimente", 120, ["Carrefour", "Mezeluri"])]);
    expect(suggestTags(state, "alimente", null, "", [], 5, NOW).sort()).toEqual([
      "Carrefour",
      "Mezeluri"
    ]);
  });

  it("excludes tags already attached to the transaction", () => {
    const state = mkState([tx("alimente", 120, ["Carrefour", "Mezeluri"])]);
    expect(suggestTags(state, "alimente", null, "", ["carrefour"], 5, NOW)).toEqual([
      "Mezeluri"
    ]);
  });

  it("ranks more frequent tags first", () => {
    const state = mkState([
      tx("fast-food", 30, ["shaorma"]),
      tx("fast-food", 32, ["shaorma"]),
      tx("fast-food", 35, ["shaorma"]),
      tx("fast-food", 40, ["KFC"])
    ]);
    expect(suggestTags(state, "fast-food", null, "", [], 5, NOW)[0]).toBe("shaorma");
  });

  it("groups case/diacritic variants and shows the most recent spelling", () => {
    const state = mkState([
      tx("fast-food", 30, ["kfc"], "2026-06-01T10:00:00.000Z"),
      tx("fast-food", 30, ["KFC"], "2026-06-20T10:00:00.000Z")
    ]);
    expect(suggestTags(state, "fast-food", null, "", [], 5, NOW)).toEqual(["KFC"]);
  });

  it("boosts tags whose historical amounts match the typed amount", () => {
    const state = mkState([
      tx("abonamente", 55.99, ["Netflix"]),
      tx("abonamente", 25, ["Spotify"]),
      tx("abonamente", 25, ["Spotify"]),
      tx("abonamente", 25, ["Spotify"])
    ]);
    // Without an amount, frequency wins.
    expect(suggestTags(state, "abonamente", null, "", [], 5, NOW)[0]).toBe("Spotify");
    // Typing Netflix's exact price flips the ranking.
    expect(suggestTags(state, "abonamente", 55.99, "", [], 5, NOW)[0]).toBe("Netflix");
  });

  it("filters live by typed text, ignoring diacritics", () => {
    const state = mkState([
      tx("fast-food", 30, ["Șaormă"]),
      tx("fast-food", 40, ["KFC"])
    ]);
    expect(suggestTags(state, "fast-food", null, "sao", [], 5, NOW)).toEqual(["Șaormă"]);
    expect(suggestTags(state, "fast-food", null, "xyz", [], 5, NOW)).toEqual([]);
  });

  it("still reads legacy transactions where note was not migrated yet", () => {
    const state = mkState([
      { id: "x1", categoryId: "fast-food", amount: 30, note: "KFC", timestamp: "2026-06-10T10:00:00.000Z" }
    ]);
    expect(suggestTags(state, "fast-food", null, "", [], 5, NOW)).toEqual(["KFC"]);
  });

  it("caps the list and drops untagged transactions", () => {
    const state = mkState([
      tx("fast-food", 10, ["a"]),
      tx("fast-food", 10, ["b"]),
      tx("fast-food", 10, ["c"]),
      tx("fast-food", 10, ["d"]),
      tx("fast-food", 10, ["e"]),
      tx("fast-food", 10, ["f"]),
      tx("fast-food", 10),
      tx("fast-food", 10, ["   "])
    ]);
    expect(suggestTags(state, "fast-food", null, "", [], 5, NOW)).toHaveLength(5);
  });
});

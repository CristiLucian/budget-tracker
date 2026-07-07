import { describe, expect, it } from "vitest";
import type { AppState, Transaction } from "../types";
import { fold, suggestNotes } from "./suggestions";

const NOW = Date.parse("2026-07-01T12:00:00.000Z");

let seq = 0;
const tx = (
  categoryId: string,
  amount: number,
  note?: string,
  timestamp = "2026-06-10T10:00:00.000Z"
): Transaction => ({ id: `t${++seq}`, categoryId, amount, note, timestamp });

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

describe("suggestNotes", () => {
  it("suggests only notes from the selected category", () => {
    const state = mkState([
      tx("fast-food", 30, "KFC"),
      tx("alimente", 100, "Lidl")
    ]);
    expect(suggestNotes(state, "fast-food", null, "", 5, NOW)).toEqual(["KFC"]);
  });

  it("ranks more frequent notes first", () => {
    const state = mkState([
      tx("fast-food", 30, "shaorma"),
      tx("fast-food", 32, "shaorma"),
      tx("fast-food", 35, "shaorma"),
      tx("fast-food", 40, "KFC")
    ]);
    expect(suggestNotes(state, "fast-food", null, "", 5, NOW)[0]).toBe("shaorma");
  });

  it("groups case/diacritic variants and shows the most recent spelling", () => {
    const state = mkState([
      tx("fast-food", 30, "kfc", "2026-06-01T10:00:00.000Z"),
      tx("fast-food", 30, "KFC", "2026-06-20T10:00:00.000Z")
    ]);
    expect(suggestNotes(state, "fast-food", null, "", 5, NOW)).toEqual(["KFC"]);
  });

  it("boosts notes whose historical amounts match the typed amount", () => {
    const state = mkState([
      tx("abonamente", 55.99, "Netflix"),
      tx("abonamente", 25, "Spotify"),
      tx("abonamente", 25, "Spotify"),
      tx("abonamente", 25, "Spotify")
    ]);
    // Without an amount, frequency wins.
    expect(suggestNotes(state, "abonamente", null, "", 5, NOW)[0]).toBe("Spotify");
    // Typing Netflix's exact price flips the ranking.
    expect(suggestNotes(state, "abonamente", 55.99, "", 5, NOW)[0]).toBe("Netflix");
  });

  it("filters live by typed text, ignoring diacritics", () => {
    const state = mkState([
      tx("fast-food", 30, "Șaormă"),
      tx("fast-food", 40, "KFC")
    ]);
    expect(suggestNotes(state, "fast-food", null, "sao", 5, NOW)).toEqual(["Șaormă"]);
    expect(suggestNotes(state, "fast-food", null, "xyz", 5, NOW)).toEqual([]);
  });

  it("caps the list and drops untitled transactions", () => {
    const state = mkState([
      tx("fast-food", 10, "a"),
      tx("fast-food", 10, "b"),
      tx("fast-food", 10, "c"),
      tx("fast-food", 10, "d"),
      tx("fast-food", 10, "e"),
      tx("fast-food", 10, "f"),
      tx("fast-food", 10),
      tx("fast-food", 10, "   ")
    ]);
    expect(suggestNotes(state, "fast-food", null, "", 5, NOW)).toHaveLength(5);
  });
});

import { describe, expect, it } from "vitest";
import type { AppState, Period, Transaction } from "./types";
import { normalizeState, reducer } from "./state";

let seq = 0;
const tx = (amount: number, timestamp = "2026-06-10T10:00:00.000Z"): Transaction => ({
  id: `t${++seq}`,
  categoryId: "alimente",
  amount,
  timestamp
});

const period = (id: string, salary: number, txs: Transaction[], extra?: Partial<Period>): Period => ({
  id,
  name: id,
  start: `${id}-07`,
  end: `${id}-07`,
  budgetAvailable: salary,
  transactions: txs,
  ...extra
});

const mkState = (periods: Period[]): AppState => ({
  settings: { monthStartDay: 7, currency: "RON", categories: [] },
  periods
});

describe("normalizeState (legacy carryIn migration)", () => {
  it("turns a non-zero manual carryIn into the carryEnabled flag", () => {
    const state = mkState([period("2026-07", 5000, [], { carryIn: 950 })]);
    const norm = normalizeState(state);
    expect(norm.periods[0].carryIn).toBeUndefined();
    expect(norm.periods[0].carryEnabled).toBe(true);
  });

  it("drops a zero carryIn without enabling the carry", () => {
    const state = mkState([period("2026-07", 5000, [], { carryIn: 0 })]);
    const norm = normalizeState(state);
    expect(norm.periods[0].carryIn).toBeUndefined();
    expect(norm.periods[0].carryEnabled).toBeUndefined();
  });

  it("returns the same object when nothing needs migrating", () => {
    const state = mkState([period("2026-07", 5000, [])]);
    expect(normalizeState(state)).toBe(state);
  });
});

describe("reducer", () => {
  it("setCarryEnabled sets the flag and clears any legacy amount", () => {
    const state = mkState([period("2026-07", 5000, [], { carryIn: 950 })]);
    const next = reducer(state, { type: "setCarryEnabled", periodId: "2026-07", enabled: true });
    expect(next.periods[0].carryEnabled).toBe(true);
    expect(next.periods[0].carryIn).toBeUndefined();
  });

  it("setCarryEnabled(false) stores undefined, not false", () => {
    const state = mkState([period("2026-07", 5000, [], { carryEnabled: true })]);
    const next = reducer(state, { type: "setCarryEnabled", periodId: "2026-07", enabled: false });
    expect(next.periods[0].carryEnabled).toBeUndefined();
  });

  it("addTransaction appends to the right period", () => {
    const state = mkState([period("2026-06", 5000, []), period("2026-07", 5000, [])]);
    const t = tx(42);
    const next = reducer(state, { type: "addTransaction", periodId: "2026-07", transaction: t });
    expect(next.periods[0].transactions).toHaveLength(0);
    expect(next.periods[1].transactions).toEqual([t]);
  });

  it("updateTransaction relocates when the date moved to another period", () => {
    const t = tx(42);
    const state = mkState([period("2026-06", 5000, [t]), period("2026-07", 5000, [])]);
    const moved = { ...t, timestamp: "2026-07-10T10:00:00.000Z" };
    const next = reducer(state, {
      type: "updateTransaction",
      periodId: "2026-06",
      transaction: moved,
      newPeriodId: "2026-07"
    });
    expect(next.periods[0].transactions).toHaveLength(0);
    expect(next.periods[1].transactions).toEqual([moved]);
  });

  it("deleteTransaction removes only the targeted transaction", () => {
    const a = tx(1);
    const b = tx(2);
    const state = mkState([period("2026-06", 5000, [a, b])]);
    const next = reducer(state, {
      type: "deleteTransaction",
      periodId: "2026-06",
      transactionId: a.id
    });
    expect(next.periods[0].transactions).toEqual([b]);
  });

  it("delete + re-add restores the transaction (undo flow)", () => {
    const t = tx(42);
    const state = mkState([period("2026-06", 5000, [t])]);
    const deleted = reducer(state, {
      type: "deleteTransaction",
      periodId: "2026-06",
      transactionId: t.id
    });
    const restored = reducer(deleted, {
      type: "addTransaction",
      periodId: "2026-06",
      transaction: t
    });
    expect(restored.periods[0].transactions).toEqual([t]);
  });

  it("deleteCategory refuses while transactions still reference it", () => {
    const state: AppState = {
      settings: {
        monthStartDay: 7,
        currency: "RON",
        categories: [{ id: "alimente", name: "Alimente", order: 0, archived: false }]
      },
      periods: [period("2026-06", 5000, [tx(10)])]
    };
    const next = reducer(state, { type: "deleteCategory", id: "alimente" });
    expect(next.settings.categories).toHaveLength(1);
  });
});

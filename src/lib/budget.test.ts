import { describe, expect, it } from "vitest";
import type { AppState, Period, Transaction } from "../types";
import { actualIncome, computeBalances, periodBalance, previousBalance } from "./budget";

let seq = 0;
const tx = (amount: number, timestamp = "2026-06-10T10:00:00.000Z"): Transaction => ({
  id: `t${++seq}`,
  categoryId: "alimente",
  amount,
  timestamp
});

const period = (id: string, salary: number, txs: Transaction[], extra?: Partial<Period>): Period => {
  const [y, m] = id.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return {
    id,
    name: id,
    start: `${id}-07`,
    end: `${ny}-${String(nm).padStart(2, "0")}-07`,
    budgetAvailable: salary,
    transactions: txs,
    ...extra
  };
};

const mkState = (periods: Period[]): AppState => ({
  settings: { monthStartDay: 7, currency: "RON", categories: [] },
  periods
});

describe("actualIncome", () => {
  it("adds salary and extra income, never the carry-over", () => {
    const p = period("2026-06", 5000, [], { extraIncome: 250, carryEnabled: true });
    expect(actualIncome(p)).toBe(5250);
  });

  it("treats missing fields as zero", () => {
    expect(actualIncome(period("2026-06", 0, []))).toBe(0);
  });
});

describe("computeBalances", () => {
  it("chains the carry across months", () => {
    const state = mkState([
      period("2026-06", 5000, [tx(4000)]),
      period("2026-07", 5000, [tx(5500)], { carryEnabled: true }),
      period("2026-08", 5000, [tx(100)], { carryEnabled: true })
    ]);
    const b = computeBalances(state);
    expect(b.get("2026-06")).toMatchObject({ carryIn: 0, leftover: 1000, carriedTo: "2026-07" });
    expect(b.get("2026-07")).toMatchObject({ carryIn: 1000, available: 6000, leftover: 500 });
    expect(b.get("2026-08")).toMatchObject({ carryIn: 500, available: 5500 });
  });

  it("propagates edits in past months forward, including deficits", () => {
    const state = mkState([
      period("2026-06", 5000, [tx(4000), tx(700)]),
      period("2026-07", 5000, [tx(5500)], { carryEnabled: true }),
      period("2026-08", 5000, [], { carryEnabled: true })
    ]);
    const b = computeBalances(state);
    expect(b.get("2026-07")?.carryIn).toBe(300);
    expect(b.get("2026-08")?.carryIn).toBe(-200);
    expect(b.get("2026-08")?.available).toBe(4800);
  });

  it("breaks the chain when a month opts out", () => {
    const state = mkState([
      period("2026-06", 5000, [tx(4000)]),
      period("2026-07", 5000, [tx(5500)]),
      period("2026-08", 5000, [], { carryEnabled: true })
    ]);
    const b = computeBalances(state);
    expect(b.get("2026-07")?.carryIn).toBe(0);
    expect(b.get("2026-06")?.carriedTo).toBeUndefined();
    expect(b.get("2026-08")?.carryIn).toBe(-500);
  });

  it("gives the first period nothing to carry in", () => {
    const state = mkState([period("2026-06", 5000, [], { carryEnabled: true })]);
    expect(computeBalances(state).get("2026-06")?.carryIn).toBe(0);
  });

  it("avoids floating point drift", () => {
    const state = mkState([
      period("2026-06", 100.1, [tx(0.2), tx(0.1)]),
      period("2026-07", 0, [], { carryEnabled: true })
    ]);
    expect(computeBalances(state).get("2026-07")?.carryIn).toBe(99.8);
  });
});

describe("periodBalance", () => {
  it("returns a zero balance for an unknown period", () => {
    expect(periodBalance(mkState([]), "2026-06")).toEqual({
      carryIn: 0,
      available: 0,
      leftover: 0
    });
  });
});

describe("previousBalance", () => {
  it("returns the chronologically previous period and its leftover", () => {
    const state = mkState([
      period("2026-06", 5000, [tx(4000)]),
      period("2026-07", 5000, [])
    ]);
    const prev = previousBalance(state, "2026-07");
    expect(prev?.period.id).toBe("2026-06");
    expect(prev?.leftover).toBe(1000);
  });

  it("returns null for the earliest period", () => {
    const state = mkState([period("2026-06", 5000, [])]);
    expect(previousBalance(state, "2026-06")).toBeNull();
  });
});

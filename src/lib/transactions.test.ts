import { describe, expect, it } from "vitest";
import type { Transaction } from "../types";
import { sortNewestFirst } from "./transactions";

const tx = (id: string, timestamp: string): Transaction => ({
  id,
  categoryId: "alimente",
  amount: 10,
  timestamp
});

describe("sortNewestFirst", () => {
  it("orders newest first", () => {
    const sorted = sortNewestFirst([
      tx("a", "2026-06-08T10:00:00.000Z"),
      tx("b", "2026-06-10T10:00:00.000Z"),
      tx("c", "2026-06-09T10:00:00.000Z")
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("handles mixed ISO precision (with and without milliseconds)", () => {
    const sorted = sortNewestFirst([
      tx("older", "2026-06-10T09:00:00Z"),
      tx("newer", "2026-06-10T10:00:00.000Z")
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["newer", "older"]);
  });

  it("keeps the most recently added first on identical timestamps", () => {
    const sorted = sortNewestFirst([
      tx("first-added", "2026-06-10T10:00:00.000Z"),
      tx("last-added", "2026-06-10T10:00:00.000Z")
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["last-added", "first-added"]);
  });

  it("does not mutate the input array", () => {
    const input = [tx("a", "2026-06-08T10:00:00.000Z"), tx("b", "2026-06-10T10:00:00.000Z")];
    sortNewestFirst(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

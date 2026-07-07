import { describe, expect, it } from "vitest";
import { parseAmount, parseMoney, sanitizeAmountInput, sumAmounts } from "./money";

describe("parseAmount", () => {
  it("accepts comma or dot as decimal separator", () => {
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });

  it("rejects empty, zero, negative and garbage input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
  });

  it("rounds to cents", () => {
    expect(parseAmount("12,555")).toBe(12.56);
  });
});

describe("parseMoney", () => {
  it("treats empty input as zero", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("-")).toBe(0);
  });

  it("accepts negatives only when allowed", () => {
    expect(parseMoney("-200", true)).toBe(-200);
    expect(parseMoney("-200")).toBeNull();
  });

  it("parses Romanian thousands format", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
  });
});

describe("sanitizeAmountInput", () => {
  it("converts dots to commas and keeps only the first comma", () => {
    expect(sanitizeAmountInput("12.5")).toBe("12,5");
    expect(sanitizeAmountInput("1,2,3")).toBe("1,23");
    expect(sanitizeAmountInput("a1b2")).toBe("12");
  });
});

describe("sumAmounts", () => {
  const tx = (amount: number) => ({
    id: "x",
    categoryId: "alimente",
    amount,
    timestamp: "2026-06-10T10:00:00.000Z"
  });

  it("sums in integer cents to avoid float drift", () => {
    expect(sumAmounts([tx(0.1), tx(0.2)])).toBe(0.3);
    expect(sumAmounts([])).toBe(0);
  });
});

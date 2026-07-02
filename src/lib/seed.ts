import seedData from "../../seed-data.json";
import type { AppState, Category, Period } from "../types";
import { slugify, uuid } from "./id";
import { makePeriod } from "./period";

type SeedFile = {
  monthStartDay: number;
  currency: string;
  categories: string[];
  periods: {
    name: string;
    start: string;
    budgetAvailable: number;
    transactions: { category: string; amount: number; note?: string }[];
  }[];
};

/**
 * Build a full AppState from the bundled seed-data.json (the history
 * migrated from the Google Sheet). Migrated transactions carry no
 * timestamps: each gets the period's start date (midday, so the date is
 * stable in any timezone) and the original order is preserved.
 */
export function buildSeedState(): AppState {
  const seed = seedData as SeedFile;

  const categories: Category[] = seed.categories.map((name, i) => ({
    id: slugify(name),
    name,
    order: i,
    archived: false
  }));
  const idByName = new Map(categories.map((c) => [c.name, c.id]));

  const periods: Period[] = seed.periods.map((p) => {
    const [y, m] = p.start.split("-").map(Number);
    const startDay = Number(p.start.split("-")[2]);
    const period = makePeriod(y, m, startDay);
    period.budgetAvailable = p.budgetAvailable;
    const stamp = new Date(y, m - 1, startDay, 12, 0, 0).toISOString();
    period.transactions = p.transactions.map((t) => {
      const categoryId = idByName.get(t.category) ?? slugify(t.category);
      return {
        id: uuid(),
        categoryId,
        amount: t.amount,
        note: t.note || undefined,
        timestamp: stamp
      };
    });
    return period;
  });

  return {
    settings: {
      monthStartDay: seed.monthStartDay,
      currency: "RON",
      categories
    },
    periods
  };
}

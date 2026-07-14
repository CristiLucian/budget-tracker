import type { AppState, Category, Period, Transaction } from "./types";
import { slugify, uuid } from "./lib/id";
import { findPeriodForDate, makePeriod, periodForDate, sortPeriods } from "./lib/period";
import { normalizeTags } from "./lib/tags";

export const DEFAULT_CATEGORY_NAMES = [
  "Fond economii",
  "Rata card de credit",
  "Abonamente",
  "Combustibil",
  "Ocazionale",
  "Fast Food",
  "Restaurant",
  "Alimente",
  "Transport",
  "Sanatate",
  "Haine",
  "Divertisment",
  "Igiena"
];

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORY_NAMES.map((name, i) => ({
    id: slugify(name),
    name,
    order: i,
    archived: false,
    isSavings: slugify(name) === "fond-economii"
  }));
}

export function emptyState(): AppState {
  return {
    settings: { monthStartDay: 7, currency: "RON", categories: defaultCategories() },
    periods: []
  };
}

/**
 * Upgrade legacy stored data. Applied to every state entering the app:
 * local storage, cloud snapshots, backup imports.
 *  - carryIn (manual carry-over amount) -> carryEnabled (computed model)
 *  - note (single free text) -> tags (comma-separated pieces become tags)
 */
export function normalizeState(state: AppState): AppState {
  const needsCarry = state.periods.some((p) => p.carryIn !== undefined);
  const needsTags = state.periods.some((p) =>
    p.transactions.some((t) => t.note !== undefined)
  );
  if (!needsCarry && !needsTags) return state;
  return {
    ...state,
    periods: state.periods.map((p) => {
      const untouched =
        p.carryIn === undefined && !p.transactions.some((t) => t.note !== undefined);
      if (untouched) return p;
      const next: Period = {
        ...p,
        transactions: p.transactions.map(migrateNoteToTags)
      };
      if (p.carryIn !== undefined) {
        next.carryEnabled = p.carryEnabled || p.carryIn !== 0 || undefined;
        delete next.carryIn;
      }
      return next;
    })
  };
}

function migrateNoteToTags(t: Transaction): Transaction {
  if (t.note === undefined) return t;
  const tags = normalizeTags([...(t.tags ?? []), ...t.note.split(",")]);
  const next: Transaction = { ...t };
  delete next.note;
  if (tags.length > 0) next.tags = tags;
  else delete next.tags;
  return next;
}

/** Add the period containing `now` if no existing period covers it. */
export function ensureCurrentPeriod(state: AppState, now: Date): AppState {
  if (findPeriodForDate(state.periods, now)) return state;
  const fresh = periodForDate(now, state.settings.monthStartDay);
  if (state.periods.some((p) => p.id === fresh.id)) return state;
  return { ...state, periods: sortPeriods([...state.periods, fresh]) };
}

/** The period that would follow the latest one (contiguous with its end). */
export function nextPeriodCandidate(state: AppState): Period | null {
  const latest = state.periods[state.periods.length - 1];
  if (!latest) return periodForDate(new Date(), state.settings.monthStartDay);
  const [y, m, d] = latest.end.split("-").map(Number);
  const candidate = makePeriod(y, m, d);
  if (state.periods.some((p) => p.id === candidate.id)) return null;
  return candidate;
}

/** The period right before the earliest one (for entering older history). */
export function prevPeriodCandidate(state: AppState): Period | null {
  const first = state.periods[0];
  if (!first) return null;
  const [y, m, d] = first.start.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const candidate = makePeriod(py, pm, d);
  if (state.periods.some((p) => p.id === candidate.id)) return null;
  return candidate;
}

export type Action =
  | { type: "import"; state: AppState }
  | { type: "ensurePeriod"; now: Date }
  | { type: "addNextPeriod" }
  | { type: "addPrevPeriod" }
  | { type: "addTransaction"; periodId: string; transaction: Transaction }
  | { type: "updateTransaction"; periodId: string; transaction: Transaction; newPeriodId?: string }
  | { type: "deleteTransaction"; periodId: string; transactionId: string }
  | { type: "setBudgetAvailable"; periodId: string; amount: number }
  | { type: "setExtraIncome"; periodId: string; amount: number }
  | { type: "setCarryEnabled"; periodId: string; enabled: boolean }
  | { type: "setMonthStartDay"; day: number }
  | { type: "addCategory"; name: string }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "moveCategory"; id: string; direction: -1 | 1 }
  | { type: "setCategoryArchived"; id: string; archived: boolean }
  | { type: "setCategorySavings"; id: string; isSavings: boolean }
  | { type: "deleteCategory"; id: string };

function mapPeriod(state: AppState, periodId: string, fn: (p: Period) => Period): AppState {
  return {
    ...state,
    periods: state.periods.map((p) => (p.id === periodId ? fn(p) : p))
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "import":
      return action.state;

    case "ensurePeriod":
      return ensureCurrentPeriod(state, action.now);

    case "addNextPeriod": {
      const candidate = nextPeriodCandidate(state);
      if (!candidate) return state;
      return { ...state, periods: sortPeriods([...state.periods, candidate]) };
    }

    case "addPrevPeriod": {
      const candidate = prevPeriodCandidate(state);
      if (!candidate) return state;
      return { ...state, periods: sortPeriods([...state.periods, candidate]) };
    }

    case "addTransaction":
      return mapPeriod(state, action.periodId, (p) => ({
        ...p,
        transactions: [...p.transactions, action.transaction]
      }));

    case "updateTransaction": {
      const target = action.newPeriodId ?? action.periodId;
      if (target === action.periodId) {
        return mapPeriod(state, action.periodId, (p) => ({
          ...p,
          transactions: p.transactions.map((t) =>
            t.id === action.transaction.id ? action.transaction : t
          )
        }));
      }
      // Timestamp moved into another period: relocate the transaction.
      let next = mapPeriod(state, action.periodId, (p) => ({
        ...p,
        transactions: p.transactions.filter((t) => t.id !== action.transaction.id)
      }));
      next = mapPeriod(next, target, (p) => ({
        ...p,
        transactions: [...p.transactions, action.transaction]
      }));
      return next;
    }

    case "deleteTransaction":
      return mapPeriod(state, action.periodId, (p) => ({
        ...p,
        transactions: p.transactions.filter((t) => t.id !== action.transactionId)
      }));

    case "setBudgetAvailable":
      return mapPeriod(state, action.periodId, (p) => ({
        ...p,
        budgetAvailable: action.amount
      }));

    case "setExtraIncome":
      return mapPeriod(state, action.periodId, (p) => ({
        ...p,
        extraIncome: action.amount || undefined
      }));

    case "setCarryEnabled":
      return mapPeriod(state, action.periodId, (p) => {
        const next: Period = { ...p, carryEnabled: action.enabled || undefined };
        delete next.carryIn; // drop any legacy manual amount
        return next;
      });

    case "setMonthStartDay":
      return {
        ...state,
        settings: { ...state.settings, monthStartDay: action.day }
      };

    case "addCategory": {
      const name = action.name.trim();
      if (!name) return state;
      let id = slugify(name);
      if (!id) id = uuid().slice(0, 8);
      while (state.settings.categories.some((c) => c.id === id)) id = `${id}-2`;
      const order =
        state.settings.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: [
            ...state.settings.categories,
            { id, name, order, archived: false }
          ]
        }
      };
    }

    case "renameCategory":
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: state.settings.categories.map((c) =>
            c.id === action.id ? { ...c, name: action.name.trim() || c.name } : c
          )
        }
      };

    case "moveCategory": {
      const sorted = [...state.settings.categories].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((c) => c.id === action.id);
      const swap = idx + action.direction;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return state;
      [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: sorted.map((c, i) => ({ ...c, order: i }))
        }
      };
    }

    case "setCategoryArchived":
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: state.settings.categories.map((c) =>
            c.id === action.id ? { ...c, archived: action.archived } : c
          )
        }
      };

    case "setCategorySavings":
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: state.settings.categories.map((c) =>
            c.id === action.id ? { ...c, isSavings: action.isSavings } : c
          )
        }
      };

    case "deleteCategory": {
      // Only allowed when the category has no transactions anywhere.
      const used = state.periods.some((p) =>
        p.transactions.some((t) => t.categoryId === action.id)
      );
      if (used) return state;
      return {
        ...state,
        settings: {
          ...state.settings,
          categories: state.settings.categories.filter((c) => c.id !== action.id)
        }
      };
    }
  }
}

export function categoryName(state: AppState, id: string): string {
  return state.settings.categories.find((c) => c.id === id)?.name ?? id;
}

export function transactionCount(state: AppState): number {
  return state.periods.reduce((s, p) => s + p.transactions.length, 0);
}

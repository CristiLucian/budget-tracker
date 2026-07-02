import type { AppState, Period, Settings } from "../types";
import type { DataAdapter } from "./adapter";
import { loadState, saveState, flush } from "../storage";
import { emptyState } from "../state";

/**
 * localStorage adapter — used while Firebase isn't configured. Keeps the
 * whole state as one JSON blob under `buget:v1` (debounced in storage.ts).
 */
export class LocalAdapter implements DataAdapter {
  private current: AppState = emptyState();

  subscribe(onState: (s: AppState) => void, onReady: () => void): () => void {
    this.current = loadState() ?? emptyState();
    onState(this.current);
    onReady();
    return () => {};
  }

  private persist(mutate: (s: AppState) => AppState): void {
    this.current = mutate(this.current);
    saveState(this.current);
  }

  saveSettings(settings: Settings): void {
    this.persist((s) => ({ ...s, settings }));
  }

  savePeriod(period: Period): void {
    this.persist((s) => {
      const exists = s.periods.some((p) => p.id === period.id);
      const periods = exists
        ? s.periods.map((p) => (p.id === period.id ? period : p))
        : [...s.periods, period].sort((a, b) => a.start.localeCompare(b.start));
      return { ...s, periods };
    });
  }

  deletePeriod(id: string): void {
    this.persist((s) => ({ ...s, periods: s.periods.filter((p) => p.id !== id) }));
  }

  async importAll(state: AppState): Promise<void> {
    this.current = state;
    saveState(state);
    flush();
  }

  flush(): void {
    flush();
  }
}

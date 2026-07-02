import type { AppState, Period, Settings } from "../types";

/**
 * Persistence backend. The UI keeps working against the reducer's AppState;
 * an adapter mirrors state changes to storage and emits remote changes back.
 */
export interface DataAdapter {
  /**
   * Start listening. `onState` fires with the full state on load and on any
   * external change; `onReady` fires once after the initial load completed.
   * Returns an unsubscribe function.
   */
  subscribe(onState: (s: AppState) => void, onReady: () => void): () => void;

  saveSettings(settings: Settings): void;
  savePeriod(period: Period): void;
  deletePeriod(id: string): void;
  /** Bulk replace everything (backup restore / seed import / migration). */
  importAll(state: AppState): Promise<void>;
  /** Flush pending debounced writes (called on tab hide). */
  flush(): void;
}

/**
 * Mirror a reducer transition to the adapter by diffing object identities —
 * the reducer is immutable, so a changed period is a new reference.
 */
export function persistDiff(adapter: DataAdapter, prev: AppState, next: AppState): void {
  if (prev === next) return;
  if (prev.settings !== next.settings) adapter.saveSettings(next.settings);
  if (prev.periods !== next.periods) {
    const prevById = new Map(prev.periods.map((p) => [p.id, p]));
    for (const p of next.periods) {
      if (prevById.get(p.id) !== p) adapter.savePeriod(p);
    }
    const nextIds = new Set(next.periods.map((p) => p.id));
    for (const p of prev.periods) {
      if (!nextIds.has(p.id)) adapter.deletePeriod(p.id);
    }
  }
}

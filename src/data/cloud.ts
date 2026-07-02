import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch
} from "firebase/firestore";
import type { AppState, Period, Settings } from "../types";
import type { DataAdapter } from "./adapter";
import { getDb } from "../firebase";
import { emptyState } from "../state";

const WRITE_DEBOUNCE_MS = 400;

/** Firestore rejects `undefined` values; JSON round-trip strips them. */
function sanitize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Firestore adapter. Layout:
 *   users/{uid}                     -> { settings }
 *   users/{uid}/periods/{periodId}  -> Period (transactions embedded)
 *
 * Offline persistence is enabled at Firestore init, so reads come from the
 * local cache instantly and writes queue while offline.
 */
export class CloudAdapter implements DataAdapter {
  private uid: string;
  private settings: Settings | null = null;
  private periods: Period[] = [];
  private knownPeriodIds = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, () => void>();

  constructor(uid: string) {
    this.uid = uid;
  }

  private userDoc() {
    return doc(getDb(), "users", this.uid);
  }

  private periodDoc(id: string) {
    return doc(getDb(), "users", this.uid, "periods", id);
  }

  subscribe(onState: (s: AppState) => void, onReady: () => void): () => void {
    let settingsReady = false;
    let periodsReady = false;
    let readyFired = false;

    const emit = () => {
      if (!settingsReady || !periodsReady) return;
      const base = emptyState();
      onState({
        settings: this.settings ?? base.settings,
        periods: [...this.periods].sort((a, b) => a.start.localeCompare(b.start))
      });
      if (!readyFired) {
        readyFired = true;
        onReady();
      }
    };

    const unsubUser = onSnapshot(
      this.userDoc(),
      (snap) => {
        this.settings = snap.exists()
          ? ((snap.data().settings as Settings | undefined) ?? null)
          : null;
        settingsReady = true;
        emit();
      },
      (err) => {
        console.error("Eroare la sincronizarea setărilor", err);
        settingsReady = true;
        emit();
      }
    );

    const unsubPeriods = onSnapshot(
      collection(getDb(), "users", this.uid, "periods"),
      (snap) => {
        this.periods = snap.docs.map((d) => d.data() as Period);
        this.knownPeriodIds = new Set(snap.docs.map((d) => d.id));
        periodsReady = true;
        emit();
      },
      (err) => {
        console.error("Eroare la sincronizarea perioadelor", err);
        periodsReady = true;
        emit();
      }
    );

    return () => {
      unsubUser();
      unsubPeriods();
      for (const t of this.timers.values()) clearTimeout(t);
      this.timers.clear();
      this.pending.clear();
    };
  }

  /** Debounce writes per document so rapid edits collapse into one write. */
  private queue(key: string, write: () => void): void {
    this.pending.set(key, write);
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        const fn = this.pending.get(key);
        this.pending.delete(key);
        fn?.();
      }, WRITE_DEBOUNCE_MS)
    );
  }

  saveSettings(settings: Settings): void {
    const clean = sanitize(settings);
    this.queue("settings", () => {
      setDoc(this.userDoc(), { settings: clean }, { merge: true }).catch((err) =>
        console.error("Eroare la salvarea setărilor", err)
      );
    });
  }

  savePeriod(period: Period): void {
    const clean = sanitize(period);
    this.queue(`period:${period.id}`, () => {
      setDoc(this.periodDoc(clean.id), clean).catch((err) =>
        console.error("Eroare la salvarea perioadei", err)
      );
    });
  }

  deletePeriod(id: string): void {
    const existing = this.timers.get(`period:${id}`);
    if (existing) clearTimeout(existing);
    this.pending.delete(`period:${id}`);
    deleteDoc(this.periodDoc(id)).catch((err) =>
      console.error("Eroare la ștergerea perioadei", err)
    );
  }

  async importAll(state: AppState): Promise<void> {
    this.flush();
    const clean = sanitize(state);
    const batch = writeBatch(getDb());
    batch.set(this.userDoc(), { settings: clean.settings }, { merge: true });
    const newIds = new Set(clean.periods.map((p) => p.id));
    for (const id of this.knownPeriodIds) {
      if (!newIds.has(id)) batch.delete(this.periodDoc(id));
    }
    for (const p of clean.periods) batch.set(this.periodDoc(p.id), p);
    await batch.commit();
  }

  flush(): void {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
      this.timers.delete(key);
      const fn = this.pending.get(key);
      this.pending.delete(key);
      fn?.();
    }
  }
}

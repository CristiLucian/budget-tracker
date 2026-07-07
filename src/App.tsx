import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import type { AppState } from "./types";
import { emptyState, ensureCurrentPeriod, normalizeState, reducer, type Action } from "./state";
import type { DataAdapter } from "./data/adapter";
import { persistDiff } from "./data/adapter";
import { LocalAdapter } from "./data/local";
import { CloudAdapter } from "./data/cloud";
import { findPeriodForDate } from "./lib/period";
import Login from "./auth/Login";
import Adauga from "./screens/Adauga";
import Dashboard from "./screens/Dashboard";
import Istoric from "./screens/Istoric";
import Statistici from "./screens/Statistici";
import Setari from "./screens/Setari";
import ThemeToggle from "./components/ThemeToggle";
import Toast, { type ToastMessage } from "./components/Toast";

export type Tab = "adauga" | "dashboard" | "istoric" | "statistici" | "setari";

function NavIcon({ tab }: { tab: Tab }) {
  const paths: Record<Tab, ReactNode> = {
    adauga: <path d="M12 5v14M5 12h14" />,
    dashboard: (
      <>
        <path d="M5 20v-6M12 20V7M19 20v-9" />
        <path d="M3.5 20h17" />
      </>
    ),
    istoric: <path d="M4 6h16M4 12h16M4 18h10" />,
    statistici: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    setari: (
      <>
        <path d="M4 8h8M18 8h2M4 16h2M12 16h8" />
        <circle cx="15" cy="8" r="2.4" />
        <circle cx="9" cy="16" r="2.4" />
      </>
    )
  };
  return (
    <svg
      className="nav__icon"
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[tab]}
    </svg>
  );
}

const NAV: { id: Tab; label: string }[] = [
  { id: "adauga", label: "Adaugă" },
  { id: "dashboard", label: "Dashboard" },
  { id: "istoric", label: "Istoric" },
  { id: "statistici", label: "Statistici" },
  { id: "setari", label: "Setări" }
];

/** Key-order-independent serialization, for comparing local vs remote state. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function Shell({
  adapter,
  account,
  onSignOut
}: {
  adapter: DataAdapter;
  account: User | null;
  onSignOut: (() => void) | null;
}) {
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  const readyRef = useRef(false);

  const [tab, setTab] = useState<Tab>("adauga");
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const apply = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      const prev = stateRef.current;
      const next = reducer(prev, action);
      if (next === prev) return;
      apply(next);
      persistDiff(adapter, prev, next);
    },
    [adapter, apply]
  );

  /** Bulk replace (seed import / backup restore / migration). */
  const importState = useCallback(
    async (incoming: AppState) => {
      const next = ensureCurrentPeriod(normalizeState(incoming), new Date());
      apply(next);
      await adapter.importAll(next);
    },
    [adapter, apply]
  );

  // Subscribe to the adapter; remote changes (other devices) flow back in.
  useEffect(() => {
    const unsub = adapter.subscribe(
      (remote) => {
        const incoming = normalizeState(remote);
        if (stableStringify(incoming) !== stableStringify(stateRef.current)) {
          apply(incoming);
        }
      },
      () => {
        readyRef.current = true;
        setReady(true);
        // Fresh account / new day: make sure the current period exists.
        const ensured = ensureCurrentPeriod(stateRef.current, new Date());
        if (ensured !== stateRef.current) {
          const prev = stateRef.current;
          apply(ensured);
          persistDiff(adapter, prev, ensured);
        }
      }
    );
    const flush = () => adapter.flush();
    window.addEventListener("beforeunload", flush);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", flush);
      adapter.flush();
    };
  }, [adapter, apply]);

  // Re-check the period while the app stays open across a boundary.
  useEffect(() => {
    const check = () => {
      if (readyRef.current) dispatch({ type: "ensurePeriod", now: new Date() });
    };
    const t = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [dispatch]);

  const currentPeriod = useMemo(
    () => findPeriodForDate(state.periods, new Date()) ?? state.periods[state.periods.length - 1],
    [state.periods]
  );

  const selectedPeriod =
    state.periods.find((p) => p.id === selectedPeriodId) ?? currentPeriod;

  function openCategoryInIstoric(catId: string, periodId: string) {
    setSelectedPeriodId(periodId);
    setCategoryFilter(catId);
    setTab("istoric");
  }

  if (!ready) {
    return (
      <div className="splash" aria-busy="true">
        <div className="splash__spinner" />
        <p>Se încarcă…</p>
      </div>
    );
  }

  const nav = (orientation: "side" | "bottom") => (
    <nav
      className={orientation === "side" ? "sidebar__nav" : "tabbar"}
      aria-label="Navigare"
    >
      {NAV.map((t) => (
        <button
          key={t.id}
          className={`nav-item ${tab === t.id ? "is-active" : ""}`}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => setTab(t.id)}
        >
          <NavIcon tab={t.id} />
          <span className="nav-item__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="3" />
              <path d="M16 12.5h2.5" />
              <path d="M7 6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" />
            </svg>
          </span>
          <span className="sidebar__title">Buget</span>
          <div className="sidebar__spacer" />
          <ThemeToggle />
        </div>
        {nav("side")}
        <div className="sidebar__footer">
          {account ? (
            <div className="account">
              <span className="account__avatar" aria-hidden="true">
                {(account.displayName ?? account.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="account__mail" title={account.email ?? ""}>
                {account.displayName ?? account.email}
              </span>
              {onSignOut && (
                <button className="linklike" onClick={onSignOut}>Ieși</button>
              )}
            </div>
          ) : (
            <span className="account account--local">Mod local</span>
          )}
        </div>
      </aside>

      <main className="main">
        {tab === "adauga" && (
          <Adauga
            state={state}
            dispatch={dispatch}
            currentPeriod={currentPeriod}
            showToast={setToast}
            goToSettings={() => setTab("setari")}
            importState={importState}
            cloudMode={account !== null}
            goToIstoric={(periodId) => {
              setSelectedPeriodId(periodId);
              setCategoryFilter(null);
              setTab("istoric");
            }}
          />
        )}
        {tab === "dashboard" && (
          <Dashboard
            state={state}
            dispatch={dispatch}
            period={selectedPeriod}
            onSelectPeriod={setSelectedPeriodId}
            onOpenCategory={openCategoryInIstoric}
            currentPeriodId={currentPeriod?.id}
            goToSettings={() => setTab("setari")}
          />
        )}
        {tab === "istoric" && (
          <Istoric
            state={state}
            dispatch={dispatch}
            period={selectedPeriod}
            onSelectPeriod={(id) => {
              setSelectedPeriodId(id);
              setCategoryFilter(null);
            }}
            categoryFilter={categoryFilter}
            onClearFilter={() => setCategoryFilter(null)}
            showToast={setToast}
          />
        )}
        {tab === "statistici" && (
          <Statistici state={state} currentPeriodId={currentPeriod?.id} />
        )}
        {tab === "setari" && (
          <Setari
            state={state}
            dispatch={dispatch}
            showToast={setToast}
            importState={importState}
            account={account}
            onSignOut={onSignOut}
          />
        )}
      </main>

      {nav("bottom")}
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const adapter = useMemo<DataAdapter | null>(() => {
    if (!isFirebaseConfigured) return new LocalAdapter();
    return user ? new CloudAdapter(user.uid) : null;
  }, [user]);

  if (!authReady) {
    return (
      <div className="splash" aria-busy="true">
        <div className="splash__spinner" />
        <p>Se încarcă…</p>
      </div>
    );
  }

  if (isFirebaseConfigured && !user) return <Login />;

  return (
    <Shell
      key={user?.uid ?? "local"}
      adapter={adapter!}
      account={user}
      onSignOut={
        isFirebaseConfigured ? () => void signOut(getFirebaseAuth()) : null
      }
    />
  );
}

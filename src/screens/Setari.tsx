import { useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { AppState } from "../types";
import type { Action } from "../state";
import { nextPeriodCandidate, prevPeriodCandidate, transactionCount } from "../state";
import { formatNumber, parseAmount } from "../lib/money";
import { buildPeriodCsv, downloadFile } from "../lib/csv";
import { buildSeedState } from "../lib/seed";
import { exportExcel } from "../lib/xlsx";
import type { ToastMessage } from "../components/Toast";

export default function Setari({
  state,
  dispatch,
  showToast,
  importState,
  account,
  onSignOut
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  showToast: (t: ToastMessage) => void;
  importState: (s: AppState) => Promise<void>;
  account: User | null;
  onSignOut: (() => void) | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [newCat, setNewCat] = useState("");
  const [csvPeriodId, setCsvPeriodId] = useState(
    state.periods[state.periods.length - 1]?.id ?? ""
  );
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const periodsDesc = [...state.periods].reverse();
  const categories = [...state.settings.categories].sort((a, b) => a.order - b.order);
  const nextCandidate = nextPeriodCandidate(state);
  const prevCandidate = prevPeriodCandidate(state);

  function commitBudget(periodId: string) {
    const draft = budgetDrafts[periodId];
    if (draft === undefined) return;
    const value = draft.trim() === "" ? 0 : parseAmount(draft);
    if (value === null) {
      showToast({ text: "Sumă invalidă" });
    } else {
      dispatch({ type: "setBudgetAvailable", periodId, amount: value });
    }
    setBudgetDrafts((d) => {
      const { [periodId]: _drop, ...rest } = d;
      return rest;
    });
  }

  function exportJson() {
    downloadFile(
      `buget-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(state, null, 2),
      "application/json"
    );
  }

  function exportCsv() {
    const period = state.periods.find((p) => p.id === csvPeriodId);
    if (!period) return;
    downloadFile(
      `buget-${period.id}.csv`,
      buildPeriodCsv(period, state.settings.categories),
      "text/csv;charset=utf-8"
    );
  }

  async function exportXlsx() {
    setExporting(true);
    try {
      await exportExcel(state);
    } finally {
      setExporting(false);
    }
  }

  function importJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppState;
        if (!parsed?.settings?.categories || !Array.isArray(parsed.periods)) {
          throw new Error("format");
        }
        if (
          transactionCount(state) > 0 &&
          !window.confirm("Înlocuiești toate datele curente cu backup-ul?")
        ) {
          return;
        }
        await importState(parsed);
        showToast({ text: "Backup importat" });
      } catch {
        showToast({ text: "Fișier invalid" });
      }
    };
    reader.readAsText(file);
  }

  async function importSeed() {
    if (
      transactionCount(state) > 0 &&
      !window.confirm("Înlocuiești toate datele curente cu istoricul din seed-data.json?")
    ) {
      return;
    }
    await importState(buildSeedState());
    showToast({ text: "Istoric importat", detail: "6 perioade, 300 de tranzacții" });
  }

  function categoryHasTransactions(id: string): boolean {
    return state.periods.some((p) => p.transactions.some((t) => t.categoryId === id));
  }

  return (
    <div className="setari">
      <header className="screen-header"><h1>Setări</h1></header>

      <div className="settings-grid">
      <section className="settings-section">
        <h2>Cont</h2>
        {account ? (
          <div className="account-row">
            <span className="account__avatar account__avatar--lg" aria-hidden="true">
              {(account.displayName ?? account.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="account-row__info">
              <strong>{account.displayName ?? account.email}</strong>
              {account.displayName && <span className="muted">{account.email}</span>}
              <span className="muted">
                Datele se sincronizează automat și funcționează și offline.
              </span>
            </div>
            {onSignOut && (
              <button className="btn btn--small" onClick={onSignOut}>Ieși din cont</button>
            )}
          </div>
        ) : (
          <p className="muted">
            Rulezi în mod local: datele stau doar pe acest dispozitiv. Pentru cont și
            sincronizare, configurează Firebase (vezi SETUP.md în repo).
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2>Perioade și buget disponibil</h2>
        <div className="period-add-row">
          {nextCandidate && (
            <button
              className="btn btn--block"
              onClick={() => {
                dispatch({ type: "addNextPeriod" });
                showToast({ text: `Perioada ${nextCandidate.name} a fost creată` });
              }}
            >
              ＋ {nextCandidate.name}
            </button>
          )}
          {prevCandidate && (
            <button
              className="btn btn--block"
              onClick={() => {
                dispatch({ type: "addPrevPeriod" });
                showToast({ text: `Perioada ${prevCandidate.name} a fost creată` });
              }}
            >
              ＋ {prevCandidate.name} (istoric)
            </button>
          )}
        </div>
        <ul className="budget-list">
          {periodsDesc.map((p) => (
            <li key={p.id} className="budget-row">
              <span className="budget-row__name">{p.name}</span>
              <input
                className="input input--inline"
                inputMode="decimal"
                value={budgetDrafts[p.id] ?? formatNumber(p.budgetAvailable)}
                onFocus={() =>
                  setBudgetDrafts((d) => ({
                    ...d,
                    [p.id]: p.budgetAvailable === 0 ? "" : String(p.budgetAvailable).replace(".", ",")
                  }))
                }
                onChange={(e) =>
                  setBudgetDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                }
                onBlur={() => commitBudget(p.id)}
                aria-label={`Buget disponibil ${p.name}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Ziua de început a lunii</h2>
        <p className="muted">Perioadele merg din această zi până în aceeași zi a lunii următoare.</p>
        <input
          className="input input--inline"
          type="number"
          min={1}
          max={28}
          value={state.settings.monthStartDay}
          onChange={(e) => {
            const day = Math.min(28, Math.max(1, Number(e.target.value) || 1));
            dispatch({ type: "setMonthStartDay", day });
          }}
          aria-label="Ziua de început a lunii"
        />
      </section>

      <section className="settings-section">
        <h2>Categorii</h2>
        <ul className="cat-manage">
          {categories.map((c, i) => (
            <li key={c.id} className={`cat-manage__row ${c.archived ? "is-archived" : ""}`}>
              <input
                className="input input--inline cat-manage__name"
                defaultValue={c.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== c.name) {
                    dispatch({ type: "renameCategory", id: c.id, name });
                  } else {
                    e.target.value = c.name;
                  }
                }}
                aria-label={`Redenumește ${c.name}`}
              />
              <button
                className="btn btn--icon"
                disabled={i === 0}
                onClick={() => dispatch({ type: "moveCategory", id: c.id, direction: -1 })}
                aria-label={`Mută ${c.name} mai sus`}
              >
                ↑
              </button>
              <button
                className="btn btn--icon"
                disabled={i === categories.length - 1}
                onClick={() => dispatch({ type: "moveCategory", id: c.id, direction: 1 })}
                aria-label={`Mută ${c.name} mai jos`}
              >
                ↓
              </button>
              {categoryHasTransactions(c.id) ? (
                <button
                  className="btn btn--small"
                  onClick={() =>
                    dispatch({ type: "setCategoryArchived", id: c.id, archived: !c.archived })
                  }
                >
                  {c.archived ? "Activează" : "Arhivează"}
                </button>
              ) : (
                <button
                  className="btn btn--small btn--danger"
                  onClick={() => {
                    if (window.confirm(`Ștergi categoria „${c.name}"?`)) {
                      dispatch({ type: "deleteCategory", id: c.id });
                    }
                  }}
                >
                  Șterge
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="cat-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (newCat.trim()) {
              dispatch({ type: "addCategory", name: newCat });
              setNewCat("");
            }
          }}
        >
          <input
            className="input input--inline"
            placeholder="Categorie nouă"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <button type="submit" className="btn">Adaugă</button>
        </form>
      </section>

      <section className="settings-section">
        <h2>Export</h2>
        <div className="export-row">
          <button className="btn" onClick={exportXlsx} disabled={exporting}>
            {exporting ? "Se generează…" : "Exportă Excel (.xlsx)"}
          </button>
          <button className="btn" onClick={exportJson}>Backup JSON</button>
        </div>
        <div className="export-row">
          <select
            className="input input--inline"
            value={csvPeriodId}
            onChange={(e) => setCsvPeriodId(e.target.value)}
            aria-label="Perioada pentru CSV"
          >
            {periodsDesc.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn" onClick={exportCsv}>Exportă CSV</button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Import</h2>
        <div className="export-row">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importă backup JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJsonFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="export-row">
          <button className="btn" onClick={importSeed}>
            Importă istoricul din Google Sheets (seed-data.json)
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}

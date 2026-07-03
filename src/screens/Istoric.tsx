import { useState } from "react";
import type { AppState, Period, Transaction } from "../types";
import type { Action } from "../state";
import { categoryName } from "../state";
import { formatLei, parseAmount, sanitizeAmountInput, sumAmounts } from "../lib/money";
import { dateInPeriod, findPeriodForDate } from "../lib/period";
import { categoryEmoji } from "../lib/icons";
import { uuid } from "../lib/id";
import PeriodPicker from "../components/PeriodPicker";
import type { ToastMessage } from "../components/Toast";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit" });
}

type View = "categorii" | "cronologic";

export default function Istoric({
  state,
  dispatch,
  period,
  onSelectPeriod,
  categoryFilter,
  onClearFilter,
  showToast
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  period: Period | undefined;
  onSelectPeriod: (id: string) => void;
  categoryFilter: string | null;
  onClearFilter: () => void;
  showToast: (t: ToastMessage) => void;
}) {
  const [view, setView] = useState<View>("categorii");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!period) {
    return (
      <div className="istoric">
        <header className="screen-header"><h1>Istoric</h1></header>
        <p className="muted">Nicio perioadă încă.</p>
      </div>
    );
  }

  const filtered = period.transactions
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !categoryFilter || t.categoryId === categoryFilter);

  const chronological = [...filtered]
    .sort((a, b) => {
      const cmp = b.t.timestamp.localeCompare(a.t.timestamp);
      return cmp !== 0 ? cmp : b.i - a.i;
    })
    .map(({ t }) => t);

  // Grouped view: categories in settings order, then orphans.
  const knownOrder = new Map(
    [...state.settings.categories]
      .sort((a, b) => a.order - b.order)
      .map((c, i) => [c.id, i])
  );
  const groupIds = [...new Set(filtered.map(({ t }) => t.categoryId))].sort((a, b) => {
    const ia = knownOrder.get(a) ?? 999;
    const ib = knownOrder.get(b) ?? 999;
    return ia - ib || a.localeCompare(b);
  });
  const groups = groupIds.map((id) => {
    const txs = filtered
      .filter(({ t }) => t.categoryId === id)
      .sort((a, b) => {
        const cmp = b.t.timestamp.localeCompare(a.t.timestamp);
        return cmp !== 0 ? cmp : b.i - a.i;
      })
      .map(({ t }) => t);
    return { id, name: categoryName(state, id), txs, total: sumAmounts(txs) };
  });

  function startEdit(t: Transaction) {
    setIsNew(false);
    setEditing(t);
    setAmount(String(t.amount).replace(".", ","));
    setCatId(t.categoryId);
    setNote(t.note ?? "");
    setWhen(toLocalInputValue(t.timestamp));
    setError(null);
  }

  function startCreate() {
    if (!period) return;
    const now = new Date();
    let ts: Date;
    if (dateInPeriod(now, period)) {
      ts = now;
    } else {
      const [y, m, d] = period.start.split("-").map(Number);
      ts = new Date(y, m - 1, d, 12, 0, 0);
    }
    const firstActive = [...state.settings.categories]
      .sort((a, b) => a.order - b.order)
      .find((c) => !c.archived);
    setIsNew(true);
    setEditing({
      id: uuid(),
      categoryId: categoryFilter ?? firstActive?.id ?? "",
      amount: 0,
      timestamp: ts.toISOString()
    });
    setAmount("");
    setCatId(categoryFilter ?? firstActive?.id ?? "");
    setNote("");
    setWhen(toLocalInputValue(ts.toISOString()));
    setError(null);
  }

  function saveEdit() {
    if (!editing || !period) return;
    const value = parseAmount(amount);
    if (value === null) {
      setError("Sumă invalidă");
      return;
    }
    const date = when ? new Date(when) : new Date(editing.timestamp);
    if (isNaN(date.getTime())) {
      setError("Dată invalidă");
      return;
    }
    const updated: Transaction = {
      ...editing,
      amount: value,
      categoryId: catId,
      note: note.trim() || undefined,
      timestamp: date.toISOString()
    };
    if (isNew) {
      const home = findPeriodForDate(state.periods, date);
      if (!home) {
        setError("Nu există o perioadă pentru această dată — creeaz-o întâi în Setări.");
        return;
      }
      dispatch({ type: "addTransaction", periodId: home.id, transaction: updated });
      setEditing(null);
      showToast({ text: "Tranzacție adăugată", detail: home.name });
      return;
    }
    const home = findPeriodForDate(state.periods, date);
    dispatch({
      type: "updateTransaction",
      periodId: period.id,
      transaction: updated,
      newPeriodId: home && home.id !== period.id ? home.id : undefined
    });
    setEditing(null);
    showToast({ text: "Tranzacție salvată" });
  }

  function deleteEditing() {
    if (!editing || !period) return;
    const name = categoryName(state, editing.categoryId);
    if (!window.confirm(`Ștergi tranzacția ${name} · ${formatLei(editing.amount)}?`)) return;
    dispatch({ type: "deleteTransaction", periodId: period.id, transactionId: editing.id });
    setEditing(null);
    showToast({ text: "Tranzacție ștearsă" });
  }

  const categories = [...state.settings.categories].sort((a, b) => a.order - b.order);

  return (
    <div className="istoric">
      <header className="screen-header"><h1>Istoric</h1></header>

      <PeriodPicker periods={state.periods} period={period} onSelect={onSelectPeriod} />

      <div className="istoric-bar">
        <div className="segmented" role="tablist" aria-label="Mod de afișare">
          <button
            role="tab"
            aria-selected={view === "categorii"}
            className={`segmented__btn ${view === "categorii" ? "is-active" : ""}`}
            onClick={() => setView("categorii")}
          >
            Pe categorii
          </button>
          <button
            role="tab"
            aria-selected={view === "cronologic"}
            className={`segmented__btn ${view === "cronologic" ? "is-active" : ""}`}
            onClick={() => setView("cronologic")}
          >
            Cronologic
          </button>
        </div>
        {categoryFilter && (
          <button className="filter-chip" onClick={onClearFilter}>
            {categoryName(state, categoryFilter)} ✕
          </button>
        )}
        <button className="btn btn--small istoric-add" onClick={startCreate}>
          ＋ Adaugă
        </button>
      </div>

      {/* Mobile: cards */}
      <div className="istoric-cards">
        {view === "categorii" ? (
          <div className="tx-groups">
            {groups.map((g) => (
              <section key={g.id} className="tx-group">
                <header className="tx-group__head">
                  <span className="tx-group__emoji" aria-hidden="true">
                    {categoryEmoji(g.id)}
                  </span>
                  <span className="tx-group__name">{g.name}</span>
                  <span className="tx-group__total">{formatLei(g.total)}</span>
                </header>
                <ul className="tx-group__list">
                  {g.txs.map((t) => (
                    <li key={t.id}>
                      <button className="tx-row" onClick={() => startEdit(t)}>
                        <span className="tx-row__date">{shortDate(t.timestamp)}</span>
                        <span className="tx-row__note">{t.note ?? ""}</span>
                        <span className="tx-row__amount">{formatLei(t.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {groups.length === 0 && <p className="muted">Nicio tranzacție.</p>}
          </div>
        ) : (
          <ul className="tx-list">
            {chronological.map((t) => (
              <li key={t.id}>
                <button className="tx" onClick={() => startEdit(t)}>
                  <span className="tx__emoji" aria-hidden="true">
                    {categoryEmoji(t.categoryId)}
                  </span>
                  <span className="tx__main">
                    <span className="tx__cat">{categoryName(state, t.categoryId)}</span>
                    <span className="tx__sub">
                      {shortDate(t.timestamp)}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                  </span>
                  <span className="tx__amount">{formatLei(t.amount)}</span>
                </button>
              </li>
            ))}
            {chronological.length === 0 && <li className="muted">Nicio tranzacție.</li>}
          </ul>
        )}
      </div>

      {/* Desktop: table */}
      <div className="istoric-table-wrap">
        {chronological.length === 0 ? (
          <p className="muted">Nicio tranzacție.</p>
        ) : (
          <table className="istoric-table">
            <thead>
              <tr>
                <th className="col-date">Data</th>
                <th className="col-cat">Categorie</th>
                <th className="col-note">Notă</th>
                <th className="col-amount">Sumă</th>
              </tr>
            </thead>
            {view === "categorii" ? (
              groups.map((g) => (
                <tbody key={g.id}>
                  <tr className="istoric-table__group">
                    <td className="col-date" aria-hidden="true">
                      {categoryEmoji(g.id)}
                    </td>
                    <td colSpan={2}>{g.name}</td>
                    <td className="col-amount">{formatLei(g.total)}</td>
                  </tr>
                  {g.txs.map((t) => (
                    <tr key={t.id} className="istoric-table__row" onClick={() => startEdit(t)} tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" ? startEdit(t) : undefined)}>
                      <td className="col-date">{shortDate(t.timestamp)}</td>
                      <td className="col-note" colSpan={2}>
                        {t.note ? t.note : <span className="muted">Fără notă</span>}
                      </td>
                      <td className="col-amount">{formatLei(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              ))
            ) : (
              <tbody>
                {chronological.map((t) => (
                  <tr key={t.id} className="istoric-table__row" onClick={() => startEdit(t)} tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" ? startEdit(t) : undefined)}>
                    <td className="col-date">{shortDate(t.timestamp)}</td>
                    <td className="col-cat">
                      <span className="tag">
                        <span aria-hidden="true">{categoryEmoji(t.categoryId)}</span>
                        {categoryName(state, t.categoryId)}
                      </span>
                    </td>
                    <td className="col-note">{t.note ?? ""}</td>
                    <td className="col-amount">{formatLei(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        )}
      </div>

      {editing && (
        <>
          <div className="sheet-backdrop" onClick={() => setEditing(null)} />
          <div className="sheet" role="dialog" aria-label={isNew ? "Adaugă tranzacție" : "Editează tranzacția"}>
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__title">{isNew ? "Adaugă tranzacție" : "Editează"}</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit();
              }}
            >
              <label className="field">
                <span className="field__label">Sumă (lei)</span>
                <input
                  className="input input--amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(sanitizeAmountInput(e.target.value));
                    setError(null);
                  }}
                />
              </label>
              <label className="field">
                <span className="field__label">Categorie</span>
                <select
                  className="input"
                  value={catId}
                  onChange={(e) => setCatId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? " (arhivată)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Notă</span>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Data și ora</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
              {error && <div className="field-error">{error}</div>}
              <div className="sheet__actions">
                {!isNew && (
                  <button type="button" className="btn btn--danger" onClick={deleteEditing}>
                    Șterge
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setEditing(null)}>
                  Renunță
                </button>
                <button type="submit" className="btn btn--primary">
                  Salvează
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

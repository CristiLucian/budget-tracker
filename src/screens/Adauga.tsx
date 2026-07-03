import { useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { transactionCount } from "../state";
import { formatLei, parseAmount, sanitizeAmountInput, sumAmounts } from "../lib/money";
import { effectiveIncome } from "../lib/budget";
import { uuid } from "../lib/id";
import { categoryEmoji } from "../lib/icons";
import { dateInPeriod } from "../lib/period";
import { loadState } from "../storage";
import PeriodPicker from "../components/PeriodPicker";
import BudgetEditor from "../components/BudgetEditor";
import type { ToastMessage } from "../components/Toast";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bună";
  if (h < 11) return "Bună dimineața";
  if (h < 18) return "Bună ziua";
  return "Bună seara";
}

export default function Adauga({
  state,
  dispatch,
  currentPeriod,
  showToast,
  importState,
  cloudMode
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  currentPeriod: Period | undefined;
  showToast: (t: ToastMessage) => void;
  goToSettings: () => void;
  importState: (s: AppState) => Promise<void>;
  cloudMode: boolean;
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(currentPeriod?.id ?? "");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const period =
    state.periods.find((p) => p.id === selectedPeriodId) ?? currentPeriod;
  const isPast = period && currentPeriod && period.id !== currentPeriod.id;

  const categories = [...state.settings.categories]
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const isEmpty = transactionCount(state) === 0;

  const available = period ? effectiveIncome(period) : 0;
  const cheltuit = period ? sumAmounts(period.transactions) : 0;
  const ramas = available - cheltuit;
  const pct = available > 0 ? Math.min(100, (cheltuit / available) * 100) : cheltuit > 0 ? 100 : 0;

  const localData = useMemo(() => {
    if (!cloudMode || !isEmpty) return null;
    const local = loadState();
    if (!local) return null;
    const tx = local.periods.reduce((s, p) => s + p.transactions.length, 0);
    return tx > 0 ? { state: local, tx } : null;
  }, [cloudMode, isEmpty]);

  useEffect(() => {
    if (activeCategoryId) amountRef.current?.focus();
  }, [activeCategoryId]);

  function close() {
    setActiveCategoryId(null);
    setAmount("");
    setNote("");
    setError(null);
  }

  function timestampFor(p: Period): string {
    const now = new Date();
    if (dateInPeriod(now, p)) return now.toISOString();
    const [y, m, d] = p.start.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
  }

  function save() {
    if (!activeCategory || !period) return;
    const value = parseAmount(amount);
    if (value === null) {
      setError("Sumă invalidă");
      amountRef.current?.focus();
      return;
    }
    const tx = {
      id: uuid(),
      categoryId: activeCategory.id,
      amount: value,
      note: note.trim() || undefined,
      timestamp: timestampFor(period)
    };
    dispatch({ type: "addTransaction", periodId: period.id, transaction: tx });
    const newRamas = available - sumAmounts([...period.transactions, tx]);
    showToast({
      text: `${activeCategory.name} · ${formatLei(value)}`,
      detail: `${isPast ? period.name + " · " : ""}Buget rămas: ${formatLei(newRamas)}`
    });
    close();
  }

  async function migrateLocal() {
    if (!localData) return;
    await importState(localData.state);
    showToast({ text: "Date mutate în cont", detail: `${localData.tx} tranzacții` });
  }

  return (
    <div className="adauga">
      <header className="screen-header">
        <h1>{greeting()}</h1>
        <span className="screen-header__sub">Ce ai cheltuit?</span>
      </header>

      {localData && (
        <div className="banner">
          <p>
            Am găsit date salvate local pe acest dispozitiv ({localData.tx} tranzacții).
            Le urci în contul tău?
          </p>
          <button className="btn btn--primary" onClick={migrateLocal}>
            Mută datele în cont
          </button>
        </div>
      )}

      {period && (
        <>
          <PeriodPicker
            periods={state.periods}
            period={period}
            onSelect={setSelectedPeriodId}
          />

          <button
            className={`budget-card ${ramas < 0 ? "budget-card--over" : ""}`}
            onClick={() => setEditingBudget(true)}
            aria-label={`Venit și buget pentru ${period.name} — apasă pentru a edita`}
          >
            <div className="budget-card__top">
              <span className="budget-card__label">Buget rămas</span>
              <span className="budget-card__edit" aria-hidden="true">✎</span>
            </div>
            <span className="budget-card__value">{formatLei(ramas)}</span>
            <span
              className="budget-card__track"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className="budget-card__fill" style={{ width: `${pct}%` }} />
            </span>
            <div className="budget-card__meta">
              <span>Disponibil <b>{formatLei(available)}</b></span>
              <span>Cheltuit <b>{formatLei(cheltuit)}</b></span>
            </div>
          </button>

          {isPast && (
            <p className="adauga__past-note">
              Adaugi în <strong>{period.name}</strong> (lună anterioară).
            </p>
          )}
        </>
      )}

      <div className="cat-grid">
        {categories.map((c) => (
          <button
            key={c.id}
            className="cat-btn"
            onClick={() => setActiveCategoryId(c.id)}
          >
            <span className="cat-btn__emoji" aria-hidden="true">{categoryEmoji(c.id)}</span>
            <span className="cat-btn__name">{c.name}</span>
          </button>
        ))}
      </div>

      {activeCategory && period && (
        <>
          <div className="sheet-backdrop" onClick={close} />
          <div className="sheet" role="dialog" aria-label={`Adaugă în ${activeCategory.name}`}>
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__title">
              <span aria-hidden="true">{categoryEmoji(activeCategory.id)}</span> {activeCategory.name}
              {isPast && <span className="sheet__subtitle"> · {period.name}</span>}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="field">
                <span className="field__label">Sumă (lei)</span>
                <input
                  ref={amountRef}
                  className="input input--amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => {
                    setAmount(sanitizeAmountInput(e.target.value));
                    setError(null);
                  }}
                />
              </label>
              {error && <div className="field-error">{error}</div>}
              <label className="field">
                <span className="field__label">Notă (opțional)</span>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="sheet__actions">
                <button type="button" className="btn" onClick={close}>
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

      {editingBudget && period && (
        <BudgetEditor
          state={state}
          period={period}
          dispatch={dispatch}
          onClose={() => setEditingBudget(false)}
        />
      )}
    </div>
  );
}

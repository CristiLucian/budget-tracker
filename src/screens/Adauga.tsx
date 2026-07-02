import { useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { transactionCount } from "../state";
import { formatLei, parseAmount, sumAmounts } from "../lib/money";
import { uuid } from "../lib/id";
import { categoryEmoji } from "../lib/icons";
import { loadState } from "../storage";
import type { ToastMessage } from "../components/Toast";

export default function Adauga({
  state,
  dispatch,
  currentPeriod,
  showToast,
  goToSettings,
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
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const categories = [...state.settings.categories]
    .filter((c) => !c.archived)
    .sort((a, b) => a.order - b.order);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const isEmpty = transactionCount(state) === 0;
  const needsBudget = currentPeriod && currentPeriod.budgetAvailable === 0 && !isEmpty;

  // Signed in with an empty account, but this device has local (pre-account)
  // data: offer a one-tap migration to the cloud.
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

  function save() {
    if (!activeCategory || !currentPeriod) return;
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
      timestamp: new Date().toISOString()
    };
    dispatch({ type: "addTransaction", periodId: currentPeriod.id, transaction: tx });
    const spent = sumAmounts([...currentPeriod.transactions, tx]);
    const ramas = currentPeriod.budgetAvailable - spent;
    showToast({
      text: `${activeCategory.name} · ${formatLei(value)}`,
      detail: `Buget rămas: ${formatLei(ramas)}`
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
        <h1>Adaugă</h1>
        {currentPeriod && <span className="screen-header__sub">{currentPeriod.name}</span>}
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

      {needsBudget && (
        <div className="banner banner--soft">
          <p>Bugetul disponibil pentru {currentPeriod!.name} nu este setat.</p>
          <button className="btn" onClick={goToSettings}>Setează în Setări</button>
        </div>
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

      {activeCategory && currentPeriod && (
        <>
          <div className="sheet-backdrop" onClick={close} />
          <div className="sheet" role="dialog" aria-label={`Adaugă în ${activeCategory.name}`}>
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__title">
              <span aria-hidden="true">{categoryEmoji(activeCategory.id)}</span> {activeCategory.name}
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
                    setAmount(e.target.value);
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
    </div>
  );
}

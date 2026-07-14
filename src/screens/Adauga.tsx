import { useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { categoryName, transactionCount } from "../state";
import { formatLei, parseAmount, sanitizeAmountInput, sumAmounts } from "../lib/money";
import { periodBalance } from "../lib/budget";
import { uuid } from "../lib/id";
import { categoryEmoji } from "../lib/icons";
import { dateInPeriod } from "../lib/period";
import { shortDate, sortNewestFirst } from "../lib/transactions";
import { formatTags, normalizeTags } from "../lib/tags";
import { loadState } from "../storage";
import PeriodPicker from "../components/PeriodPicker";
import BudgetEditor from "../components/BudgetEditor";
import TagInput from "../components/TagInput";
import type { ToastMessage } from "../components/Toast";

export default function Adauga({
  state,
  dispatch,
  currentPeriod,
  showToast,
  importState,
  cloudMode,
  goToIstoric
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  currentPeriod: Period | undefined;
  showToast: (t: ToastMessage) => void;
  goToSettings: () => void;
  importState: (s: AppState) => Promise<void>;
  cloudMode: boolean;
  goToIstoric: (periodId: string) => void;
}) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(currentPeriod?.id ?? "");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
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

  const available = period ? periodBalance(state, period.id).available : 0;
  const cheltuit = period ? sumAmounts(period.transactions) : 0;
  const ramas = available - cheltuit;
  const pct = available > 0 ? Math.min(100, (cheltuit / available) * 100) : cheltuit > 0 ? 100 : 0;
  // Warn (red) once you're near or over the budget.
  const over = ramas < 0 || (available > 0 && pct >= 90);

  const recent = useMemo(
    () => (period ? sortNewestFirst(period.transactions).slice(0, 10) : []),
    [period]
  );

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
    setTags([]);
    setTagDraft("");
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
    // Text still sitting in the tag input counts as a tag too.
    const finalTags = normalizeTags([...tags, tagDraft]);
    const tx = {
      id: uuid(),
      categoryId: activeCategory.id,
      amount: value,
      tags: finalTags.length > 0 ? finalTags : undefined,
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
    <div className={`adauga ${period && recent.length > 0 ? "adauga--panel" : ""}`}>
      <header className="screen-header">
        <h1>Buget</h1>
        <span className="screen-header__sub">Adaugă o cheltuială</span>
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
            className={`budget-card ${over ? "budget-card--over" : ""}`}
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

      {period && recent.length > 0 && (
        <section className="recent-tx">
          <h2 className="recent-tx__title">Ultimele tranzacții</h2>
          <ul className="tx-list">
            {recent.map((t) => (
              <li key={t.id}>
                <button
                  className="tx"
                  onClick={() => goToIstoric(period.id)}
                  aria-label={`${categoryName(state, t.categoryId)}: ${formatLei(t.amount)} — vezi în Istoric`}
                >
                  <span className="tx__emoji" aria-hidden="true">
                    {categoryEmoji(t.categoryId)}
                  </span>
                  <span className="tx__main">
                    <span className="tx__cat">{categoryName(state, t.categoryId)}</span>
                    <span className="tx__sub">
                      {shortDate(t.timestamp)}
                      {formatTags(t) ? ` · ${formatTags(t)}` : ""}
                    </span>
                  </span>
                  <span className="tx__amount">{formatLei(t.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            className="btn btn--block recent-tx__more"
            onClick={() => goToIstoric(period.id)}
          >
            Vezi toate tranzacțiile din {period.name} ({period.transactions.length}) →
          </button>
        </section>
      )}

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
              <TagInput
                state={state}
                categoryId={activeCategory.id}
                amount={parseAmount(amount)}
                tags={tags}
                draft={tagDraft}
                onTagsChange={setTags}
                onDraftChange={setTagDraft}
              />
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

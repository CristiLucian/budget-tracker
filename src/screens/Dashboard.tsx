import { useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { formatLei, sumAmounts } from "../lib/money";
import { savingsIdSet, savingsOf, spendingOf } from "../lib/categories";
import { computeBalances } from "../lib/budget";
import { categoryEmoji } from "../lib/icons";
import PeriodPicker from "../components/PeriodPicker";
import BudgetEditor from "../components/BudgetEditor";

export default function Dashboard({
  state,
  dispatch,
  period,
  onSelectPeriod,
  onOpenCategory,
  currentPeriodId,
  goToSettings
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  period: Period | undefined;
  onSelectPeriod: (id: string) => void;
  onOpenCategory: (categoryId: string, periodId: string) => void;
  currentPeriodId: string | undefined;
  goToSettings: () => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  if (!period) {
    return (
      <div className="dashboard">
        <header className="screen-header"><h1>Dashboard</h1></header>
        <p className="muted">Nicio perioadă încă.</p>
      </div>
    );
  }

  const cheltuit = sumAmounts(period.transactions);
  const bal = computeBalances(state).get(period.id) ?? {
    carryIn: 0,
    available: 0,
    leftover: 0
  };
  const available = bal.available; // venit real + report calculat
  const hasBreakdown = (period.extraIncome ?? 0) !== 0 || bal.carryIn !== 0;
  const ramas = bal.leftover;
  const savingsIds = savingsIdSet(state);
  const savings = savingsOf(period.transactions, savingsIds);
  const spending = spendingOf(period.transactions, savingsIds);
  const pct =
    available > 0
      ? Math.min(100, (cheltuit / available) * 100)
      : cheltuit > 0
        ? 100
        : 0;

  const totalsByCategory = new Map<string, number>();
  for (const t of period.transactions) {
    totalsByCategory.set(
      t.categoryId,
      (totalsByCategory.get(t.categoryId) ?? 0) + Math.round(t.amount * 100)
    );
  }

  // Every visible category, even with zero spend; archived/removed ones
  // only when they still have transactions in this period.
  const rows = [...state.settings.categories]
    .sort((a, b) => a.order - b.order)
    .filter((c) => !c.archived || totalsByCategory.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      total: (totalsByCategory.get(c.id) ?? 0) / 100
    }));
  for (const [id, cents] of totalsByCategory) {
    if (!rows.some((r) => r.id === id)) rows.push({ id, name: id, total: cents / 100 });
  }
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  const isCurrent = period.id === currentPeriodId;
  const needsBudget = isCurrent && available === 0;
  const over = ramas < 0 || (available > 0 && pct >= 90);

  return (
    <div className="dashboard">
      <header className="screen-header"><h1>Dashboard</h1></header>

      <PeriodPicker periods={state.periods} period={period} onSelect={onSelectPeriod} />

      {needsBudget && (
        <div className="banner banner--soft">
          <p>Bugetul disponibil pentru {period.name} nu este setat.</p>
          <button className="btn" onClick={goToSettings}>Setează în Setări</button>
        </div>
      )}

      <div className="dashboard__grid">
      <button
        type="button"
        className={`hero hero--btn ${over ? "hero--negative" : ""}`}
        onClick={() => setEditingBudget(true)}
        aria-label={`Buget ${period.name} — apasă pentru a edita venitul`}
      >
        <span className="hero__top">
          <span className="hero__label">Buget rămas</span>
          <span className="hero__edit" aria-hidden="true">✎</span>
        </span>
        <span className="hero__value">{formatLei(ramas)}</span>
        <span
          className="hero__track"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Procent cheltuit"
        >
          <span className="hero__fill" style={{ width: `${pct}%` }} />
        </span>
        <div className="hero__stats">
          <span className="hero__stat">
            <span className="hero__stat-label">Disponibil</span>
            <span className="hero__stat-value">{formatLei(available)}</span>
            {hasBreakdown && (
              <span className="hero__stat-note">
                salariu {formatLei(period.budgetAvailable)}
                {(period.extraIncome ?? 0) !== 0 && ` · alte ${formatLei(period.extraIncome!)}`}
                {bal.carryIn !== 0 &&
                  ` · report ${bal.carryIn < 0 ? "−" : "+"}${formatLei(Math.abs(bal.carryIn))}`}
              </span>
            )}
          </span>
          <span className="hero__stat hero__stat--right">
            <span className="hero__stat-label">Cheltuit</span>
            <span className="hero__stat-value">{formatLei(cheltuit)}</span>
          </span>
        </div>
        {savings > 0 && (
          <div className="hero__breakdown">
            <span>🛒 Cheltuieli reale: {formatLei(spending)}</span>
            <span>💰 Economii: {formatLei(savings)}</span>
          </div>
        )}
        {bal.carriedTo && (
          <div className="hero__carryout">
            ↪ Soldul rămas se reportează în {bal.carriedTo}
          </div>
        )}
      </button>

      <ul className="cat-totals">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              className={`cat-total ${r.total === 0 ? "cat-total--zero" : ""}`}
              onClick={() => onOpenCategory(r.id, period.id)}
              aria-label={`${r.name}: ${formatLei(r.total)} — vezi tranzacțiile`}
            >
              <span className="cat-total__emoji" aria-hidden="true">
                {categoryEmoji(r.id)}
              </span>
              <span className="cat-total__body">
                <span className="cat-total__row">
                  <span className="cat-total__name">{r.name}</span>
                  <span className="cat-total__amount">{formatLei(r.total)}</span>
                </span>
                <span className="cat-total__bar">
                  <span
                    className="cat-total__fill"
                    style={{ width: `${(r.total / maxTotal) * 100}%` }}
                  />
                </span>
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="muted">Nicio categorie.</li>}
      </ul>
      </div>

      {editingBudget && (
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

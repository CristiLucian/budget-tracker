import { useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { formatLei, formatNumber, parseMoney, sanitizeAmountInput } from "../lib/money";
import { previousBalance } from "../lib/budget";

function toDraft(n: number | undefined): string {
  if (!n) return "";
  return formatNumber(n).replace(/\./g, "");
}

/**
 * Per-period income editor: salariu + alte venituri, plus the carry-over
 * toggle. The carried amount itself is computed (previous period's closing
 * balance), so it stays correct even when past months change later.
 */
export default function BudgetEditor({
  state,
  period,
  dispatch,
  onClose
}: {
  state: AppState;
  period: Period;
  dispatch: (a: Action) => void;
  onClose: () => void;
}) {
  const [salary, setSalary] = useState(toDraft(period.budgetAvailable));
  const [extra, setExtra] = useState(toDraft(period.extraIncome));
  const [carryOn, setCarryOn] = useState(!!period.carryEnabled);
  const [error, setError] = useState<string | null>(null);

  const prev = previousBalance(state, period.id);
  const carryValue = carryOn && prev ? prev.leftover : 0;

  const preview =
    (parseMoney(salary) ?? 0) + (parseMoney(extra) ?? 0) + carryValue;

  function save() {
    const s = parseMoney(salary);
    const e = parseMoney(extra);
    if (s === null || e === null) {
      setError("Sumă invalidă");
      return;
    }
    dispatch({ type: "setBudgetAvailable", periodId: period.id, amount: s });
    dispatch({ type: "setExtraIncome", periodId: period.id, amount: e });
    dispatch({
      type: "setCarryEnabled",
      periodId: period.id,
      enabled: carryOn && prev !== null
    });
    onClose();
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Venit ${period.name}`}>
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__title">Venit · {period.name}</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="field">
            <span className="field__label">Salariu / venit de bază</span>
            <input
              className="input"
              inputMode="decimal"
              value={salary}
              onChange={(e) => {
                setSalary(sanitizeAmountInput(e.target.value));
                setError(null);
              }}
            />
          </label>

          <label className="field">
            <span className="field__label">Alte venituri</span>
            <input
              className="input"
              inputMode="decimal"
              value={extra}
              onChange={(e) => {
                setExtra(sanitizeAmountInput(e.target.value));
                setError(null);
              }}
            />
          </label>

          {prev && (
            <div className="field">
              <span className="field__label">Report din {prev.period.name}</span>
              <label className={`carry-toggle ${carryOn ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={carryOn}
                  onChange={(e) => setCarryOn(e.target.checked)}
                />
                <span className="carry-toggle__text">
                  Preia soldul rămas:{" "}
                  <strong className={prev.leftover < 0 ? "negative" : ""}>
                    {formatLei(prev.leftover)}
                  </strong>
                </span>
              </label>
              {carryOn && (
                <p className="carry-toggle__hint">
                  Suma se recalculează automat dacă modifici tranzacții sau
                  venituri în {prev.period.name}.
                </p>
              )}
            </div>
          )}

          {error && <div className="field-error">{error}</div>}

          <div className="budget-editor__total">
            <span>Total disponibil</span>
            <strong>{formatLei(preview)}</strong>
          </div>

          <div className="sheet__actions">
            <button type="button" className="btn" onClick={onClose}>Renunță</button>
            <button type="submit" className="btn btn--primary">Salvează</button>
          </div>
        </form>
      </div>
    </>
  );
}

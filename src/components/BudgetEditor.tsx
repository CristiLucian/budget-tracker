import { useState } from "react";
import type { AppState, Period } from "../types";
import type { Action } from "../state";
import { formatLei, formatNumber, parseMoney, sanitizeAmountInput } from "../lib/money";
import { suggestedCarryIn } from "../lib/budget";

function toDraft(n: number | undefined): string {
  if (!n) return "";
  return formatNumber(n).replace(/\./g, "");
}

/**
 * Per-period income editor: salariu + alte venituri + report din luna
 * trecută (optional, with a one-tap suggestion). All three add up to the
 * money available for the month.
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
  const [carry, setCarry] = useState(toDraft(period.carryIn));
  const [error, setError] = useState<string | null>(null);

  const suggestion = suggestedCarryIn(state, period.id);

  const preview =
    (parseMoney(salary) ?? 0) + (parseMoney(extra) ?? 0) + (parseMoney(carry, true) ?? 0);

  function save() {
    const s = parseMoney(salary);
    const e = parseMoney(extra);
    const c = parseMoney(carry, true);
    if (s === null || e === null || c === null) {
      setError("Sumă invalidă");
      return;
    }
    dispatch({ type: "setBudgetAvailable", periodId: period.id, amount: s });
    dispatch({ type: "setExtraIncome", periodId: period.id, amount: e });
    dispatch({ type: "setCarryIn", periodId: period.id, amount: c });
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

          <label className="field">
            <span className="field__label">Report din luna trecută</span>
            <input
              className="input"
              inputMode="decimal"
              value={carry}
              onChange={(e) => {
                // allow a leading minus for a carried-over deficit
                const raw = e.target.value.trim();
                const neg = raw.startsWith("-");
                setCarry((neg ? "-" : "") + sanitizeAmountInput(raw));
                setError(null);
              }}
            />
          </label>
          {suggestion !== 0 && (
            <button
              type="button"
              className="carry-suggest"
              onClick={() => setCarry(toDraft(Math.abs(suggestion)).replace(/^/, suggestion < 0 ? "-" : ""))}
            >
              ↩ Reportează soldul lunii trecute: {formatLei(suggestion)}
            </button>
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

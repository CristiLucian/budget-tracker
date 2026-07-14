import { useEffect, useState } from "react";
import type { AppState, Period, Transaction } from "../types";
import type { Action } from "../state";
import { categoryName } from "../state";
import { formatLei, parseAmount, parseMoney, sanitizeAmountInput, sumAmounts } from "../lib/money";
import { dateInPeriod, findPeriodForDate } from "../lib/period";
import { shortDate, sortNewestFirst } from "../lib/transactions";
import { fold, formatTags, normalizeTags, tagsOf } from "../lib/tags";
import TagInput from "../components/TagInput";
import { categoryEmoji } from "../lib/icons";
import { uuid } from "../lib/id";
import PeriodPicker from "../components/PeriodPicker";
import type { ToastMessage } from "../components/Toast";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type View = "categorii" | "cronologic";

export default function Istoric({
  state,
  dispatch,
  period,
  onSelectPeriod,
  categoryFilter,
  onClearFilter,
  focusTxId,
  onClearFocus,
  showToast
}: {
  state: AppState;
  dispatch: (a: Action) => void;
  period: Period | undefined;
  onSelectPeriod: (id: string) => void;
  categoryFilter: string | null;
  onClearFilter: () => void;
  // Transaction to open for editing on arrival (e.g. tapped in Adaugă).
  focusTxId: string | null;
  onClearFocus: () => void;
  showToast: (t: ToastMessage) => void;
}) {
  const [view, setView] = useState<View>("categorii");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  // The period the edited transaction lives in — can differ from the
  // selected period when editing straight from a search result.
  const [editingPeriodId, setEditingPeriodId] = useState<string>("");
  const [isNew, setIsNew] = useState(false);
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  function startEdit(t: Transaction, sourcePeriodId?: string) {
    setIsNew(false);
    setEditingPeriodId(sourcePeriodId ?? period!.id);
    setEditing(t);
    setAmount(String(t.amount).replace(".", ","));
    setCatId(t.categoryId);
    setTags(tagsOf(t));
    setTagDraft("");
    setWhen(toLocalInputValue(t.timestamp));
    setError(null);
  }

  // Arriving with a target transaction (tapped in another screen): open its
  // edit sheet directly, then consume the request so it doesn't reopen.
  useEffect(() => {
    if (!focusTxId) return;
    for (const p of state.periods) {
      const t = p.transactions.find((x) => x.id === focusTxId);
      if (t) {
        startEdit(t, p.id);
        break;
      }
    }
    onClearFocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTxId]);

  if (!period) {
    return (
      <div className="istoric">
        <header className="screen-header"><h1>Istoric</h1></header>
        <p className="muted">Nicio perioadă încă.</p>
      </div>
    );
  }

  const tagFilterFold = tagFilter ? fold(tagFilter) : null;
  const filtered = period.transactions.filter(
    (t) =>
      (!categoryFilter || t.categoryId === categoryFilter) &&
      (!tagFilterFold || tagsOf(t).some((tag) => fold(tag) === tagFilterFold))
  );

  const chronological = sortNewestFirst(filtered);

  // Tags used in the selected period, biggest spend first, for the filter
  // chips. A stale filter (tag absent from this month) still gets a chip so
  // it can be switched off.
  const periodTagCents = new Map<string, { display: string; cents: number }>();
  for (const t of period.transactions) {
    for (const tag of tagsOf(t)) {
      const key = fold(tag);
      const e = periodTagCents.get(key) ?? { display: tag, cents: 0 };
      e.cents += Math.round(t.amount * 100);
      periodTagCents.set(key, e);
    }
  }
  if (tagFilterFold && !periodTagCents.has(tagFilterFold)) {
    periodTagCents.set(tagFilterFold, { display: tagFilter!, cents: 0 });
  }
  const periodTags = [...periodTagCents.entries()]
    .sort((a, b) => b[1].cents - a[1].cents || a[0].localeCompare(b[0]))
    .map(([key, e]) => ({ key, display: e.display }));

  // Grouped view: categories in settings order, then orphans.
  const knownOrder = new Map(
    [...state.settings.categories]
      .sort((a, b) => a.order - b.order)
      .map((c, i) => [c.id, i])
  );
  const groupIds = [...new Set(filtered.map((t) => t.categoryId))].sort((a, b) => {
    const ia = knownOrder.get(a) ?? 999;
    const ib = knownOrder.get(b) ?? 999;
    return ia - ib || a.localeCompare(b);
  });
  const groups = groupIds.map((id) => {
    const txs = sortNewestFirst(filtered.filter((t) => t.categoryId === id));
    return { id, name: categoryName(state, id), txs, total: sumAmounts(txs) };
  });

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
    setEditingPeriodId(period.id);
    setEditing({
      id: uuid(),
      categoryId: categoryFilter ?? firstActive?.id ?? "",
      amount: 0,
      timestamp: ts.toISOString()
    });
    setAmount("");
    setCatId(categoryFilter ?? firstActive?.id ?? "");
    setTags([]);
    setTagDraft("");
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
    // Text still sitting in the tag input counts as a tag too.
    const finalTags = normalizeTags([...tags, tagDraft]);
    const updated: Transaction = {
      ...editing,
      amount: value,
      categoryId: catId,
      tags: finalTags.length > 0 ? finalTags : undefined,
      timestamp: date.toISOString()
    };
    delete updated.note; // legacy field, superseded by tags
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
      periodId: editingPeriodId,
      transaction: updated,
      newPeriodId: home && home.id !== editingPeriodId ? home.id : undefined
    });
    setEditing(null);
    showToast({ text: "Tranzacție salvată" });
  }

  function deleteEditing() {
    if (!editing) return;
    const deleted = editing;
    const homeId = editingPeriodId;
    dispatch({ type: "deleteTransaction", periodId: homeId, transactionId: deleted.id });
    setEditing(null);
    showToast({
      text: "Tranzacție ștearsă",
      detail: `${categoryName(state, deleted.categoryId)} · ${formatLei(deleted.amount)}`,
      durationMs: 6000,
      action: {
        label: "Anulează",
        run: () =>
          dispatch({ type: "addTransaction", periodId: homeId, transaction: deleted })
      }
    });
  }

  const categories = [...state.settings.categories].sort((a, b) => a.order - b.order);

  // Cross-month search: matches any tag, the category name (both
  // diacritic-insensitive) or an exact amount ("45,50").
  const q = query.trim();
  const qFold = fold(q);
  const qNum = q ? parseMoney(q) : null;
  const searchResults = q
    ? state.periods
        .flatMap((p) =>
          p.transactions
            .filter(
              (t) =>
                tagsOf(t).some((tag) => fold(tag).includes(qFold)) ||
                fold(categoryName(state, t.categoryId)).includes(qFold) ||
                (qNum !== null && qNum > 0 && Math.abs(t.amount - qNum) < 0.005)
            )
            .map((t) => ({ t, periodId: p.id, periodName: p.name }))
        )
        .sort((a, b) => Date.parse(b.t.timestamp) - Date.parse(a.t.timestamp))
    : [];

  return (
    <div className="istoric">
      <header className="screen-header"><h1>Istoric</h1></header>

      <div className="istoric-search">
        <input
          className="input"
          type="search"
          placeholder="Caută în toate lunile — tag, categorie sau sumă"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Caută tranzacții în toate lunile"
        />
      </div>

      {q ? (
        <div className="search-results">
          <p className="muted">
            {searchResults.length === 0
              ? "Niciun rezultat."
              : `${searchResults.length} ${searchResults.length === 1 ? "rezultat" : "rezultate"} în toate lunile · total ${formatLei(sumAmounts(searchResults.map((r) => r.t)))}${searchResults.length > 50 ? " — primele 50" : ""}`}
          </p>
          <ul className="tx-list">
            {searchResults.slice(0, 50).map(({ t, periodId, periodName }) => (
              <li key={t.id}>
                <button className="tx" onClick={() => startEdit(t, periodId)}>
                  <span className="tx__emoji" aria-hidden="true">
                    {categoryEmoji(t.categoryId)}
                  </span>
                  <span className="tx__main">
                    <span className="tx__cat">{categoryName(state, t.categoryId)}</span>
                    <span className="tx__sub">
                      {periodName} · {shortDate(t.timestamp)}
                      {formatTags(t) ? ` · ${formatTags(t)}` : ""}
                    </span>
                  </span>
                  <span className="tx__amount">{formatLei(t.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
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

      {periodTags.length > 0 && (
        <div className="chip-row chip-row--scroll istoric-tags" aria-label="Filtrează după tag">
          {periodTags.map(({ key, display }) => (
            <button
              key={key}
              className={`chip ${key === tagFilterFold ? "is-active" : ""}`}
              aria-pressed={key === tagFilterFold}
              onClick={() => setTagFilter(key === tagFilterFold ? null : display)}
            >
              {display}
            </button>
          ))}
        </div>
      )}

      {tagFilter && (
        <p className="istoric-tag-total">
          <strong>{tagFilter}</strong> în {period.name}:{" "}
          <strong>{formatLei(sumAmounts(filtered))}</strong> ·{" "}
          {filtered.length === 1 ? "o tranzacție" : `${filtered.length} tranzacții`}
        </p>
      )}

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
                        <span className="tx-row__note">{formatTags(t)}</span>
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
                      {formatTags(t) ? ` · ${formatTags(t)}` : ""}
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
                {view === "cronologic" && <th className="col-cat">Categorie</th>}
                <th className="col-note">Taguri</th>
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
                    <td>{g.name}</td>
                    <td className="col-amount">{formatLei(g.total)}</td>
                  </tr>
                  {g.txs.map((t) => (
                    <tr key={t.id} className="istoric-table__row" onClick={() => startEdit(t)} tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" ? startEdit(t) : undefined)}>
                      <td className="col-date">{shortDate(t.timestamp)}</td>
                      <td className="col-note">
                        {formatTags(t) || <span className="muted">Fără taguri</span>}
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
                    <td className="col-note">{formatTags(t)}</td>
                    <td className="col-amount">{formatLei(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        )}
      </div>
        </>
      )}

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
              <TagInput
                state={state}
                categoryId={catId}
                amount={parseAmount(amount)}
                tags={tags}
                draft={tagDraft}
                onTagsChange={setTags}
                onDraftChange={setTagDraft}
              />
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

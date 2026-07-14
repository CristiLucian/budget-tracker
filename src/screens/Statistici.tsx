import { useMemo, useState } from "react";
import type { AppState } from "../types";
import { categoryName } from "../state";
import { formatLei, sumAmounts } from "../lib/money";
import { savingsIdSet, savingsOf, spendingOf } from "../lib/categories";
import { actualIncome, computeBalances } from "../lib/budget";
import { categoryEmoji } from "../lib/icons";
import { fold, formatTags, tagsOf } from "../lib/tags";
import { MONTHS_RO } from "../lib/period";
import { MiniBars, PairBars, PercentLine } from "../components/charts";

function shortPeriodLabel(id: string): string {
  const [y, m] = id.split("-").map(Number);
  return `${MONTHS_RO[m - 1].slice(0, 3)} '${String(y).slice(2)}`;
}

/** Romanian percent display: 20,6% */
function pct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

// Internal sections so the screen stays short and single-purpose:
// General (monthly overview), Categorii, Taguri, Anual.
type Tab = "general" | "categorii" | "taguri" | "anual";

const TABS: [Tab, string][] = [
  ["general", "General"],
  ["categorii", "Categorii"],
  ["taguri", "Taguri"],
  ["anual", "Anual"]
];

export default function Statistici({
  state,
  currentPeriodId
}: {
  state: AppState;
  currentPeriodId: string | undefined;
}) {
  const periods = state.periods;
  const balances = useMemo(() => computeBalances(state), [state]);
  const withData = periods.filter(
    (p) => p.transactions.length > 0 || (balances.get(p.id)?.available ?? 0) > 0
  );
  const [selectedCat, setSelectedCat] = useState<string>("alimente");
  const [tab, setTab] = useState<Tab>("general");

  // Year scope for the time-based cards. Defaults to the current year so
  // charts stay readable as history grows; "Toți anii" is one tap away.
  const years = [...new Set(withData.map((p) => p.id.slice(0, 4)))].sort();
  const currentYear = currentPeriodId?.slice(0, 4);
  const [yearSel, setYearSel] = useState<string | null>(null);
  const year =
    yearSel ?? (currentYear && years.includes(currentYear) ? currentYear : "all");

  // Per-tag spending, with its own month/all-time scope ("cât am dat pe
  // Carrefour luna asta?") independent of the year chips above.
  const [tagQuery, setTagQuery] = useState("");
  const [tagPeriod, setTagPeriod] = useState<string>("all");
  const tagRows = useMemo(() => {
    const savingsIds = savingsIdSet(state);
    const source =
      tagPeriod === "all" ? periods : periods.filter((p) => p.id === tagPeriod);
    const byTag = new Map<string, { display: string; cents: number; count: number }>();
    for (const p of source) {
      for (const t of p.transactions) {
        if (savingsIds.has(t.categoryId)) continue; // real spending only
        for (const tag of tagsOf(t)) {
          const key = fold(tag);
          const e = byTag.get(key) ?? { display: tag, cents: 0, count: 0 };
          e.cents += Math.round(t.amount * 100);
          e.count += 1;
          byTag.set(key, e);
        }
      }
    }
    return [...byTag.entries()]
      .map(([key, e]) => ({ key, display: e.display, total: e.cents / 100, count: e.count }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }, [state, periods, tagPeriod]);

  const stats = useMemo(() => {
    // Savings categories (e.g. Fond economii) are money kept, not spent.
    // They still count in "cheltuit" (money that left the budget) but are
    // excluded from every spending statistic below.
    const savingsIds = savingsIdSet(state);

    const perPeriod = withData.map((p) => {
      const cheltuit = sumAmounts(p.transactions);
      const spending = spendingOf(p.transactions, savingsIds);
      const savings = savingsOf(p.transactions, savingsIds);
      // Report (carry-in) is deliberately kept OUT of income: it's last
      // month's money, already counted as income once. It only widens the
      // amount available to spend.
      const venit = actualIncome(p); // salariu + alte venituri
      const bal = balances.get(p.id) ?? { carryIn: 0, available: venit, leftover: 0 };
      return {
        id: p.id,
        name: p.name,
        label: shortPeriodLabel(p.id),
        salariu: p.budgetAvailable || 0,
        venit,
        report: bal.carryIn,
        disponibil: bal.available, // venit + report
        cheltuit, // total outflow incl. savings (for the vs-budget chart)
        spending, // real spending, excl. savings
        savings,
        // % of real income not spent on real expenses (leftover + savings)
        rata: venit > 0 ? ((venit - spending) / venit) * 100 : 0,
        txCount: p.transactions.length
      };
    });

    // Year-scoped views (charts, category analysis, top expenses). The
    // KPI row, salary card and bottom facts stay all-time on purpose.
    const scopedPer =
      year === "all" ? perPeriod : perPeriod.filter((p) => p.id.startsWith(year));
    const scopedPeriods =
      year === "all" ? withData : withData.filter((p) => p.id.startsWith(year));
    // The running month has no complete picture yet — leave it out of the
    // savings-rate line so it doesn't distort the trend.
    const rataPer = scopedPer.filter((p) => p.id !== currentPeriodId);

    const totalSpending = perPeriod.reduce((s, p) => s + Math.round(p.spending * 100), 0) / 100;
    const closed = perPeriod.filter((p) => p.id !== currentPeriodId);
    const avgBase = closed.length > 0 ? closed : perPeriod;
    const mean = (sel: (p: (typeof perPeriod)[number]) => number) =>
      avgBase.length > 0 ? avgBase.reduce((s, p) => s + sel(p), 0) / avgBase.length : 0;
    const avgSpending = mean((p) => p.spending);
    const avgSavings = mean((p) => p.savings);
    const avgRata = mean((p) => p.rata);
    const scumpa = [...perPeriod].sort((a, b) => b.spending - a.spending)[0];
    const txTotal = perPeriod.reduce((s, p) => s + p.txCount, 0);

    // Category aggregates within the selected year scope
    const catTotals = new Map<string, { total: number; count: number }>();
    for (const p of scopedPeriods) {
      for (const t of p.transactions) {
        const e = catTotals.get(t.categoryId) ?? { total: 0, count: 0 };
        e.total += Math.round(t.amount * 100);
        e.count += 1;
        catTotals.set(t.categoryId, e);
      }
    }
    const catRows = [...catTotals.entries()]
      .map(([id, e]) => ({
        id,
        total: e.total / 100,
        count: e.count,
        avgTx: e.total / 100 / e.count
      }))
      .sort((a, b) => b.total - a.total);

    // Dominant spending category — all-time (bottom facts), savings excluded
    const globalCatCents = new Map<string, number>();
    for (const p of periods) {
      for (const t of p.transactions) {
        if (savingsIds.has(t.categoryId)) continue;
        globalCatCents.set(
          t.categoryId,
          (globalCatCents.get(t.categoryId) ?? 0) + Math.round(t.amount * 100)
        );
      }
    }
    const dominantEntry = [...globalCatCents.entries()].sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantEntry
      ? { id: dominantEntry[0], total: dominantEntry[1] / 100 }
      : null;

    // Top expenses within the year scope — real spending only, not savings
    const allTx = scopedPeriods.flatMap((p) =>
      p.transactions
        .filter((t) => !savingsIds.has(t.categoryId))
        .map((t) => ({ ...t, periodName: p.name }))
    );
    const topTx = [...allTx].sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Cumulative savings across all savings categories
    const savedTotal =
      periods
        .flatMap((p) => p.transactions)
        .filter((t) => savingsIds.has(t.categoryId))
        .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;

    // Current period projection (daily burn rate)
    let projection: {
      periodName: string;
      dailyRate: number;
      projected: number;
      budget: number;
      daysLeft: number;
    } | null = null;
    const current = periods.find((p) => p.id === currentPeriodId);
    if (current && current.transactions.length > 0) {
      const start = new Date(current.start + "T00:00:00").getTime();
      const end = new Date(current.end + "T00:00:00").getTime();
      const now = Date.now();
      const daysElapsed = Math.max(1, (Math.min(now, end) - start) / 86_400_000);
      const daysTotal = (end - start) / 86_400_000;
      const spent = sumAmounts(current.transactions);
      const dailyRate = spent / daysElapsed;
      projection = {
        periodName: current.name,
        dailyRate,
        projected: dailyRate * daysTotal,
        budget: balances.get(current.id)?.available ?? actualIncome(current),
        daysLeft: Math.max(0, Math.round(daysTotal - daysElapsed))
      };
    }

    // Busiest month by number of transactions
    const busiest = [...perPeriod].sort((a, b) => b.txCount - a.txCount)[0];

    // Salary evolution — venitul de bază only (no extra income, no carry).
    const salaryMonths = perPeriod.filter((p) => p.salariu > 0);
    const avgSalary =
      salaryMonths.length > 0
        ? salaryMonths.reduce((s, p) => s + p.salariu, 0) / salaryMonths.length
        : 0;
    const maxSalaryMonth =
      [...salaryMonths].sort((a, b) => b.salariu - a.salariu)[0] ?? null;
    const firstSalary = salaryMonths[0] ?? null;
    const lastSalary = salaryMonths[salaryMonths.length - 1] ?? null;
    const salaryGrowth =
      firstSalary && lastSalary && firstSalary !== lastSalary
        ? ((lastSalary.salariu - firstSalary.salariu) / firstSalary.salariu) * 100
        : null;
    const extraTotal =
      periods.reduce((s, p) => s + Math.round((p.extraIncome || 0) * 100), 0) / 100;

    // Yearly aggregates (cents to avoid float drift); carry-over excluded —
    // it would double-count across the year's months.
    const yearCents = new Map<
      string,
      { venit: number; spending: number; savings: number; months: number }
    >();
    for (const p of perPeriod) {
      const y = p.id.slice(0, 4);
      const e = yearCents.get(y) ?? { venit: 0, spending: 0, savings: 0, months: 0 };
      e.venit += Math.round(p.venit * 100);
      e.spending += Math.round(p.spending * 100);
      e.savings += Math.round(p.savings * 100);
      e.months += 1;
      yearCents.set(y, e);
    }
    const yearRows = [...yearCents.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([y, e]) => ({
        year: y,
        months: e.months,
        venit: e.venit / 100,
        spending: e.spending / 100,
        savings: e.savings / 100,
        rata: e.venit > 0 ? ((e.venit - e.spending) / e.venit) * 100 : 0
      }))
      .filter((r) => year === "all" || r.year === year);

    return {
      perPeriod,
      scopedPer,
      rataPer,
      totalSpending,
      avgSpending,
      avgSavings,
      avgRata,
      scumpa,
      txTotal,
      catRows,
      dominant,
      topTx,
      savedTotal,
      projection,
      busiest,
      salaryMonthCount: salaryMonths.length,
      avgSalary,
      maxSalaryMonth,
      firstSalary,
      lastSalary,
      salaryGrowth,
      extraTotal,
      yearRows
    };
  }, [state, periods, withData, balances, currentPeriodId, year]);

  if (stats.perPeriod.length === 0) {
    return (
      <div className="statistici">
        <header className="screen-header"><h1>Statistici</h1></header>
        <p className="muted">Adaugă tranzacții ca să vezi statistici.</p>
      </div>
    );
  }

  const catForChart = stats.catRows.some((c) => c.id === selectedCat)
    ? selectedCat
    : stats.catRows[0]?.id ?? "";
  const scopedWithData =
    year === "all" ? withData : withData.filter((p) => p.id.startsWith(year));
  const catSeries = scopedWithData.map((p) => ({
    label: shortPeriodLabel(p.id),
    value:
      p.transactions
        .filter((t) => t.categoryId === catForChart)
        .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100
  }));
  const catInfo = stats.catRows.find((c) => c.id === catForChart);
  const monthsWithSpend = catSeries.filter((s) => s.value > 0).length;
  // Card-title suffix making the active scope visible on every filtered card.
  const scope = year === "all" ? "" : ` · ${year}`;

  const anyTags = periods.some((p) => p.transactions.some((t) => tagsOf(t).length > 0));
  const tagQueryFold = fold(tagQuery.trim());
  const tagMatches = tagQueryFold
    ? tagRows.filter((r) => r.key.includes(tagQueryFold))
    : tagRows;
  const TAG_LIMIT = 12;
  const tagShown = tagQueryFold ? tagMatches : tagMatches.slice(0, TAG_LIMIT);

  // Year chips shared by the tabs whose cards are year-scoped.
  const yearFilter = (
    <div className="year-filter">
      <div className="chip-row" role="tablist" aria-label="Anul pentru statistici">
        <button
          role="tab"
          aria-selected={year === "all"}
          className={`chip ${year === "all" ? "is-active" : ""}`}
          onClick={() => setYearSel("all")}
        >
          Toți anii
        </button>
        {years.map((y) => (
          <button
            key={y}
            role="tab"
            aria-selected={year === y}
            className={`chip ${year === y ? "is-active" : ""}`}
            onClick={() => setYearSel(y)}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="statistici">
      <header className="screen-header"><h1>Statistici</h1></header>

      <div className="segmented statistici-tabs" role="tablist" aria-label="Secțiuni statistici">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`segmented__btn ${tab === id ? "is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <>
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi__label">Medie cheltuieli / lună</span>
          <span className="kpi__value">{formatLei(stats.avgSpending)}</span>
          <span className="kpi__sub">fără economii</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Medie economii / lună</span>
          <span className="kpi__value">{formatLei(stats.avgSavings)}</span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Rată medie economisire</span>
          <span className={`kpi__value ${stats.avgRata < 0 ? "negative" : ""}`}>
            {pct(stats.avgRata)}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Cea mai scumpă lună</span>
          <span className="kpi__value">{stats.scumpa?.name}</span>
          <span className="kpi__sub">{formatLei(stats.scumpa?.spending ?? 0)}</span>
        </div>
      </div>

      {stats.projection && (
        <section className="stat-card stat-card--accent">
          <h2>Proiecție {stats.projection.periodName}</h2>
          <p>
            Ritm actual: <strong>{formatLei(stats.projection.dailyRate)}/zi</strong> · încă{" "}
            {stats.projection.daysLeft} zile
          </p>
          <p>
            Estimare la final:{" "}
            <strong>{formatLei(stats.projection.projected)}</strong>{" "}
            {stats.projection.budget > 0 && (
              <span
                className={
                  stats.projection.projected > stats.projection.budget ? "negative" : "positive"
                }
              >
                ({stats.projection.projected > stats.projection.budget ? "peste" : "sub"} bugetul de{" "}
                {formatLei(stats.projection.budget)})
              </span>
            )}
          </p>
        </section>
      )}

      {yearFilter}

      <section className="stat-card">
        <h2>Cheltuit vs. disponibil{scope}</h2>
        <PairBars
          data={stats.scopedPer.map((p) => ({
            label: p.label,
            // negative carry shrinks the bar; positive carry stacks on top
            a: Math.max(0, p.report < 0 ? p.venit + p.report : p.venit),
            aExtra: Math.max(0, p.report),
            b: p.cheltuit
          }))}
          aLabel="Venit"
          aExtraLabel="Report"
          bLabel="Cheltuit"
        />
      </section>

      <section className="stat-card">
        <h2>Rata de economisire{scope}</h2>
        <p className="muted">
          Cât la sută din venitul lunii (salariu + alte venituri, fără report)
          nu a mers pe cheltuieli reale (economii puse deoparte + ce a rămas).
          Luna în curs nu este inclusă.
        </p>
        {stats.rataPer.length > 0 ? (
          <PercentLine
            data={stats.rataPer.map((p) => ({ label: p.label, value: p.rata }))}
          />
        ) : (
          <p className="muted">Apare după prima lună încheiată.</p>
        )}
      </section>
        </>
      )}

      {tab === "categorii" && (
        <>
      {yearFilter}

      <section className="stat-card">
        <h2>Analiză pe categorie{scope}</h2>
        <div className="chip-row chip-row--scroll" role="tablist" aria-label="Alege categoria">
          {stats.catRows.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === catForChart}
              className={`chip ${c.id === catForChart ? "is-active" : ""}`}
              onClick={() => setSelectedCat(c.id)}
            >
              {categoryEmoji(c.id)} {categoryName(state, c.id)}
            </button>
          ))}
        </div>
        <MiniBars data={catSeries} />
        {catInfo && (
          <div className="stat-facts">
            <div><span className="muted">Total</span><strong>{formatLei(catInfo.total)}</strong></div>
            <div>
              <span className="muted">Medie / lună activă</span>
              <strong>{formatLei(monthsWithSpend > 0 ? catInfo.total / monthsWithSpend : 0)}</strong>
            </div>
            <div><span className="muted">Tranzacții</span><strong>{catInfo.count}</strong></div>
            <div><span className="muted">Medie / tranzacție</span><strong>{formatLei(catInfo.avgTx)}</strong></div>
          </div>
        )}
      </section>

      <section className="stat-card">
        <h2>Top 10 cheltuieli{scope}</h2>
        <ol className="top-list">
          {stats.topTx.map((t, i) => (
            <li key={t.id} className="top-row">
              <span className="top-row__rank">{i + 1}</span>
              <span className="top-row__emoji" aria-hidden="true">{categoryEmoji(t.categoryId)}</span>
              <span className="top-row__main">
                <span className="top-row__cat">{categoryName(state, t.categoryId)}</span>
                <span className="top-row__per">
                  {t.periodName}
                  {formatTags(t) ? ` · ${formatTags(t)}` : ""}
                </span>
              </span>
              <span className="top-row__amount">{formatLei(t.amount)}</span>
            </li>
          ))}
        </ol>
      </section>
        </>
      )}

      {tab === "taguri" &&
        (anyTags ? (
        <section className="stat-card">
          <h2>Cheltuieli pe taguri</h2>
          <p className="muted">Totalul cheltuit pe fiecare tag, fără economii.</p>
          <div className="tag-stats__controls">
            <input
              className="input"
              type="search"
              placeholder="Caută un tag…"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              aria-label="Caută un tag"
            />
            <select
              className="input"
              value={tagPeriod}
              onChange={(e) => setTagPeriod(e.target.value)}
              aria-label="Perioada pentru statistica pe taguri"
            >
              <option value="all">Toate lunile</option>
              {[...withData].reverse().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {tagShown.length === 0 ? (
            <p className="muted">
              {tagRows.length === 0
                ? "Nicio tranzacție cu taguri în perioada aleasă."
                : "Niciun tag nu se potrivește căutării."}
            </p>
          ) : (
            <ul className="tag-stats">
              {tagShown.map((r) => (
                <li key={r.key} className="tag-stats__row">
                  <span className="tag-stats__name">{r.display}</span>
                  <span className="tag-stats__count">
                    {r.count === 1 ? "o tranzacție" : `${r.count} tranzacții`}
                  </span>
                  <strong className="tag-stats__total">{formatLei(r.total)}</strong>
                </li>
              ))}
            </ul>
          )}
          {!tagQueryFold && tagMatches.length > TAG_LIMIT && (
            <p className="muted tag-stats__more">
              Primele {TAG_LIMIT} din {tagMatches.length} taguri — caută pentru restul.
            </p>
          )}
        </section>
        ) : (
          <p className="muted">
            Nicio tranzacție cu taguri încă — adaugă taguri din formularul de
            cheltuieli.
          </p>
        ))}

      {tab === "anual" && (
        <>
      <section className="stat-card">
        <h2>Sumar anual{scope}</h2>
        <div className="year-table-wrap">
          <table className="year-table">
            <thead>
              <tr>
                <th>An</th>
                <th>Venit</th>
                <th>Cheltuieli</th>
                <th>Economii</th>
                <th>Rată</th>
              </tr>
            </thead>
            <tbody>
              {stats.yearRows.map((y) => (
                <tr key={y.year}>
                  <td>
                    {y.year}
                    <span className="muted"> · {y.months} {y.months === 1 ? "lună" : "luni"}</span>
                  </td>
                  <td>{formatLei(y.venit)}</td>
                  <td>{formatLei(y.spending)}</td>
                  <td>{formatLei(y.savings)}</td>
                  <td className={y.rata < 0 ? "negative" : ""}>{pct(y.rata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted year-table__note">
          Cheltuieli = fără economii. Rata pe venit real (fără report).
        </p>
      </section>

      {stats.salaryMonthCount > 0 && (
        <section className="stat-card">
          <h2>Salariu</h2>
          <p className="muted">
            Venitul de bază pe luni — fără alte venituri și fără report.
          </p>
          <MiniBars
            data={stats.perPeriod.map((p) => ({ label: p.label, value: p.salariu }))}
          />
          <div className="stat-facts">
            <div>
              <span className="muted">Medie / lună</span>
              <strong>{formatLei(stats.avgSalary)}</strong>
            </div>
            <div>
              <span className="muted">
                Cel mai mare{stats.maxSalaryMonth ? ` (${stats.maxSalaryMonth.label})` : ""}
              </span>
              <strong>{formatLei(stats.maxSalaryMonth?.salariu ?? 0)}</strong>
            </div>
            {stats.salaryGrowth !== null && stats.firstSalary && stats.lastSalary && (
              <div>
                <span className="muted">
                  Evoluție {stats.firstSalary.label} → {stats.lastSalary.label}
                </span>
                <strong className={stats.salaryGrowth < 0 ? "negative" : ""}>
                  {stats.salaryGrowth >= 0 ? "+" : ""}
                  {pct(stats.salaryGrowth)}
                </strong>
              </div>
            )}
            <div>
              <span className="muted">Alte venituri (total)</span>
              <strong>{formatLei(stats.extraTotal)}</strong>
            </div>
          </div>
        </section>
      )}
        </>
      )}

      {tab === "general" && (
      <div className="fact-grid">
        <div className="stat-card fact">
          <span className="fact__emoji" aria-hidden="true">💰</span>
          <div>
            <strong>{formatLei(stats.savedTotal)}</strong>
            <span className="muted">puși deoparte în economii, în total</span>
          </div>
        </div>
        <div className="stat-card fact">
          <span className="fact__emoji" aria-hidden="true">🧾</span>
          <div>
            <strong>{stats.busiest?.name}</strong>
            <span className="muted">
              luna cea mai activă — {stats.busiest?.txCount} tranzacții
            </span>
          </div>
        </div>
        <div className="stat-card fact">
          <span className="fact__emoji" aria-hidden="true">{categoryEmoji(stats.dominant?.id ?? "")}</span>
          <div>
            <strong>{stats.dominant ? categoryName(state, stats.dominant.id) : "—"}</strong>
            <span className="muted">
              categoria dominantă —{" "}
              {stats.totalSpending > 0 && stats.dominant
                ? `${((stats.dominant.total / stats.totalSpending) * 100).toFixed(0)}% din cheltuieli`
                : "—"}
            </span>
          </div>
        </div>
        <div className="stat-card fact">
          <span className="fact__emoji" aria-hidden="true">📈</span>
          <div>
            <strong>{formatLei(stats.totalSpending)}</strong>
            <span className="muted">total cheltuieli (fără economii)</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

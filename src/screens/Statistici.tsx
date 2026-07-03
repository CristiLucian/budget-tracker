import { useMemo, useState } from "react";
import type { AppState } from "../types";
import { categoryName } from "../state";
import { formatLei, sumAmounts } from "../lib/money";
import { savingsIdSet, savingsOf, spendingOf } from "../lib/categories";
import { effectiveIncome } from "../lib/budget";
import { categoryEmoji } from "../lib/icons";
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

export default function Statistici({
  state,
  currentPeriodId
}: {
  state: AppState;
  currentPeriodId: string | undefined;
}) {
  const periods = state.periods;
  const withData = periods.filter((p) => p.transactions.length > 0 || effectiveIncome(p) > 0);
  const [selectedCat, setSelectedCat] = useState<string>("alimente");

  const stats = useMemo(() => {
    // Savings categories (e.g. Fond economii) are money kept, not spent.
    // They still count in "cheltuit" (money that left the budget) but are
    // excluded from every spending statistic below.
    const savingsIds = savingsIdSet(state);

    const perPeriod = withData.map((p) => {
      const cheltuit = sumAmounts(p.transactions);
      const spending = spendingOf(p.transactions, savingsIds);
      const savings = savingsOf(p.transactions, savingsIds);
      const income = effectiveIncome(p); // salariu + alte venituri + report
      return {
        id: p.id,
        name: p.name,
        label: shortPeriodLabel(p.id),
        disponibil: income,
        cheltuit, // total outflow incl. savings (for the vs-budget chart)
        spending, // real spending, excl. savings
        savings,
        ramas: income - cheltuit,
        // % of income not spent on real expenses (leftover + savings)
        rata: income > 0 ? ((income - spending) / income) * 100 : 0,
        txCount: p.transactions.length
      };
    });

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

    // Category aggregates across all periods
    const catTotals = new Map<string, { total: number; count: number }>();
    for (const p of periods) {
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

    // Dominant spending category (savings excluded)
    const dominant = catRows.find((c) => !savingsIds.has(c.id)) ?? null;

    // Top expenses — real spending only, not savings deposits
    const allTx = periods.flatMap((p) =>
      p.transactions
        .filter((t) => !savingsIds.has(t.categoryId))
        .map((t) => ({ ...t, periodId: p.id }))
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
        budget: effectiveIncome(current),
        daysLeft: Math.max(0, Math.round(daysTotal - daysElapsed))
      };
    }

    // Busiest month by number of transactions
    const busiest = [...perPeriod].sort((a, b) => b.txCount - a.txCount)[0];

    return {
      perPeriod,
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
      busiest
    };
  }, [state, periods, withData, currentPeriodId]);

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
  const catSeries = withData.map((p) => ({
    label: shortPeriodLabel(p.id),
    value:
      p.transactions
        .filter((t) => t.categoryId === catForChart)
        .reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100
  }));
  const catInfo = stats.catRows.find((c) => c.id === catForChart);
  const monthsWithSpend = catSeries.filter((s) => s.value > 0).length;

  return (
    <div className="statistici">
      <header className="screen-header"><h1>Statistici</h1></header>

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

      <section className="stat-card">
        <h2>Cheltuit vs. disponibil</h2>
        <PairBars
          data={stats.perPeriod.map((p) => ({
            label: p.label,
            a: p.disponibil,
            b: p.cheltuit
          }))}
          aLabel="Disponibil"
          bLabel="Cheltuit"
        />
      </section>

      <section className="stat-card">
        <h2>Rata de economisire</h2>
        <p className="muted">
          Cât la sută din venitul disponibil nu a mers pe cheltuieli reale
          (economii puse deoparte + ce a rămas).
        </p>
        <PercentLine
          data={stats.perPeriod.map((p) => ({ label: p.label, value: p.rata }))}
        />
      </section>

      <section className="stat-card">
        <h2>Analiză pe categorie</h2>
        <div className="chip-row" role="tablist" aria-label="Alege categoria">
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
        <h2>Top 10 cheltuieli</h2>
        <table className="stat-table stat-table--top">
          <thead>
            <tr><th>Perioadă</th><th>Categorie</th><th className="num">Sumă</th></tr>
          </thead>
          <tbody>
            {stats.topTx.map((t) => (
              <tr key={t.id}>
                <td>{shortPeriodLabel(t.periodId)}</td>
                <td className="topcat">
                  <span aria-hidden="true">{categoryEmoji(t.categoryId)}</span>{" "}
                  {categoryName(state, t.categoryId)}
                </td>
                <td className="num">{formatLei(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

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
    </div>
  );
}

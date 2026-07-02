import type { Period } from "../types";

export default function PeriodSwitcher({
  periods,
  period,
  onSelect
}: {
  periods: Period[];
  period: Period | undefined;
  onSelect: (id: string) => void;
}) {
  if (!period) return null;
  const idx = periods.findIndex((p) => p.id === period.id);
  const prev = idx > 0 ? periods[idx - 1] : null;
  const next = idx >= 0 && idx < periods.length - 1 ? periods[idx + 1] : null;

  return (
    <div className="period-switcher">
      <button
        className="period-switcher__btn"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.id)}
        aria-label="Perioada anterioară"
      >
        ‹
      </button>
      <span className="period-switcher__name">{period.name}</span>
      <button
        className="period-switcher__btn"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
        aria-label="Perioada următoare"
      >
        ›
      </button>
    </div>
  );
}

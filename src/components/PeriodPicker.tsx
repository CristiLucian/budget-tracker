import { useEffect, useMemo, useRef, useState } from "react";
import type { Period } from "../types";
import { MONTHS_RO } from "../lib/period";

/**
 * Month navigator: prev/next arrows plus a calendar-style popover (year +
 * month grid) to jump to any period. Scales to many years far better than a
 * long flat dropdown.
 */
export default function PeriodPicker({
  periods,
  period,
  onSelect
}: {
  periods: Period[];
  period: Period | undefined;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Map "year-monthIndex" (of each period's START month) -> period id.
  const byCell = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of periods) {
      const [y, mo] = p.start.split("-").map(Number);
      m.set(`${y}-${mo - 1}`, p.id);
    }
    return m;
  }, [periods]);

  const years = useMemo(
    () => periods.map((p) => Number(p.start.slice(0, 4))),
    [periods]
  );
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear();
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();

  const selectedYear = period ? Number(period.start.slice(0, 4)) : maxYear;
  const [viewYear, setViewYear] = useState(selectedYear);

  // Re-centre the calendar on the selected period whenever it changes.
  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!period) return null;

  const idx = periods.findIndex((p) => p.id === period.id);
  const prev = idx > 0 ? periods[idx - 1] : null;
  const next = idx >= 0 && idx < periods.length - 1 ? periods[idx + 1] : null;

  return (
    <div className="period-picker" ref={ref}>
      <button
        className="period-picker__arrow"
        disabled={!prev}
        onClick={() => prev && onSelect(prev.id)}
        aria-label="Perioada anterioară"
      >
        ‹
      </button>

      <button
        className="period-picker__current"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{period.name}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <button
        className="period-picker__arrow"
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
        aria-label="Perioada următoare"
      >
        ›
      </button>

      {open && (
        <div className="period-cal" role="dialog" aria-label="Alege perioada">
          <div className="period-cal__head">
            <button
              className="period-cal__nav"
              disabled={viewYear <= minYear}
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Anul anterior"
            >
              ‹
            </button>
            <span className="period-cal__year">{viewYear}</span>
            <button
              className="period-cal__nav"
              disabled={viewYear >= maxYear}
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Anul următor"
            >
              ›
            </button>
          </div>
          <div className="period-cal__grid">
            {MONTHS_RO.map((name, m) => {
              const id = byCell.get(`${viewYear}-${m}`);
              const isSel = id === period.id;
              return (
                <button
                  key={m}
                  className={`period-cal__month ${isSel ? "is-active" : ""}`}
                  disabled={!id}
                  aria-current={isSel ? "true" : undefined}
                  title={id ? `${name} ${viewYear}` : `${name} ${viewYear} — fără date`}
                  onClick={() => {
                    if (id) {
                      onSelect(id);
                      setOpen(false);
                    }
                  }}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

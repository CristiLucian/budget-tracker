import { useEffect, useRef, useState } from "react";
import type { Period } from "../types";

/**
 * Month navigator: prev/next arrows plus a dropdown to jump straight to
 * any period without stepping through them one by one.
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

  // newest first for the dropdown
  const desc = [...periods].sort((a, b) => b.start.localeCompare(a.start));
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
        aria-haspopup="listbox"
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
        <ul className="period-menu" role="listbox" aria-label="Alege perioada">
          {desc.map((p) => (
            <li key={p.id}>
              <button
                role="option"
                aria-selected={p.id === period.id}
                className={`period-menu__item ${p.id === period.id ? "is-active" : ""}`}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

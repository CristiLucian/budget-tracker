import { useMemo } from "react";
import type { AppState } from "../types";
import { fold, suggestNotes } from "../lib/suggestions";

/**
 * Tappable note suggestions under the note input. Live-filtered by what's
 * typed; tapping a tag fills the note, tapping the active tag clears it.
 */
export default function NoteSuggestions({
  state,
  categoryId,
  amount,
  note,
  onPick
}: {
  state: AppState;
  categoryId: string;
  amount: number | null;
  note: string;
  onPick: (note: string) => void;
}) {
  const suggestions = useMemo(
    () => suggestNotes(state, categoryId, amount, note),
    [state, categoryId, amount, note]
  );

  if (suggestions.length === 0) return null;
  const noteFold = fold(note.trim());

  return (
    <div className="chip-row note-tags" aria-label="Sugestii de notă">
      {suggestions.map((s) => {
        const active = fold(s) === noteFold;
        return (
          <button
            type="button"
            key={s}
            className={`chip ${active ? "is-active" : ""}`}
            aria-pressed={active}
            onClick={() => onPick(active ? "" : s)}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

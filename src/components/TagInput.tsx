import { useMemo, useRef } from "react";
import type { AppState } from "../types";
import { normalizeTags } from "../lib/tags";
import { suggestTags } from "../lib/suggestions";

/**
 * Tag editor for a transaction: attached tags as removable chips, a text
 * input (Enter or comma commits the text as a tag, Backspace on an empty
 * input removes the last one) and tappable suggestions underneath that
 * append a tag. The draft lives in the parent so it can fold the not-yet
 * committed text into the tags on save.
 */
export default function TagInput({
  state,
  categoryId,
  amount,
  tags,
  draft,
  onTagsChange,
  onDraftChange
}: {
  state: AppState;
  categoryId: string;
  amount: number | null;
  tags: string[];
  draft: string;
  onTagsChange: (tags: string[]) => void;
  onDraftChange: (draft: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => suggestTags(state, categoryId, amount, draft, tags),
    [state, categoryId, amount, draft, tags]
  );

  function add(tag: string) {
    onTagsChange(normalizeTags([...tags, tag]));
    onDraftChange("");
    inputRef.current?.focus();
  }

  function handleChange(value: string) {
    // A comma commits everything before it; pasted "a, b, c" works too.
    if (value.includes(",")) {
      const parts = value.split(",");
      const rest = parts.pop() ?? "";
      const committed = normalizeTags([...tags, ...parts]);
      if (committed.length !== tags.length) onTagsChange(committed);
      onDraftChange(rest.trimStart());
    } else {
      onDraftChange(value);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && draft.trim()) {
      e.preventDefault(); // add the tag instead of submitting the form
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="field field--with-tags">
      <span className="field__label">Taguri (opțional)</span>
      <div
        className="input tag-input"
        onClick={(e) => {
          if (e.target === e.currentTarget) inputRef.current?.focus();
        }}
      >
        {tags.map((t) => (
          <span className="tag-input__tag" key={t}>
            {t}
            <button
              type="button"
              className="tag-input__remove"
              aria-label={`Șterge tagul ${t}`}
              onClick={() => onTagsChange(tags.filter((x) => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="tag-input__field"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="sentences"
          placeholder={tags.length === 0 ? "magazin, produs, brand…" : ""}
          aria-label="Adaugă un tag"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="tag-suggest">
          <span className="tag-suggest__label">Sugestii</span>
          <div className="chip-row" aria-label="Sugestii de taguri">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s}
                className="chip chip--add"
                onClick={() => add(s)}
              >
                <span aria-hidden="true">+</span> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORY_EMOJI: Record<string, string> = {
  "fond-economii": "💰",
  "rata-card-de-credit": "💳",
  abonamente: "📺",
  combustibil: "⛽",
  ocazionale: "🎁",
  "fast-food": "🍔",
  restaurant: "🍽️",
  alimente: "🛒",
  transport: "🚌",
  sanatate: "💊",
  haine: "👕",
  divertisment: "🎬",
  igiena: "🧼"
};

export function categoryEmoji(id: string): string {
  return CATEGORY_EMOJI[id] ?? "🏷️";
}

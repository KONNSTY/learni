// Spiegelt apps/api/learni_api/engine/hearts.py fuer den lokalen Mock-Modus.
export const DECIDABLE = new Set(["multiple_choice", "matching", "fill_blank", "listen_pick", "word_order"]);
export const isDecidable = (type: string) => DECIDABLE.has(type);

export interface HeartState { count: number; max: number | null }

/** Sprechfehler und nicht entscheidbare Formate kosten NIE ein Herz. */
export function loseHeart(h: HeartState, type: string): { state: HeartState; lost: number } {
  if (h.max === null || !isDecidable(type) || h.count <= 0) return { state: h, lost: 0 };
  return { state: { ...h, count: h.count - 1 }, lost: 1 };
}
export const addHeart = (h: HeartState): HeartState => (h.max === null ? h : { ...h, count: Math.min(h.count + 1, h.max) });

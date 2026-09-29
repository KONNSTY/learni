// Viseme-IDs 0..21 (Azure-kompatibel). Spiegelt apps/api/learni_api/providers/visemes.py.
export const VISEME_MIN = 0;
export const VISEME_MAX = 21;
export interface VisemeEvent { t_ms: number; viseme: number }

const LETTER_TO_VISEME: Record<string, number> = {
  a: 2, e: 4, i: 6, o: 8, u: 7, y: 6, h: 12, r: 13, l: 14, s: 15, z: 15, c: 20, k: 20, g: 20, q: 20, x: 20,
  f: 18, v: 18, w: 7, d: 19, t: 19, n: 19, j: 16, p: 21, b: 21, m: 21,
};
const base = (ch: string) => ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function textToVisemes(text: string, durationMs: number): VisemeEvent[] {
  const chars = [...text].filter((c) => /\p{L}|\s/u.test(c));
  if (!chars.length || durationMs <= 0) return [{ t_ms: 0, viseme: 0 }];
  const step = durationMs / chars.length;
  const out: VisemeEvent[] = [];
  chars.forEach((ch, i) => {
    const v = /\s/.test(ch) ? 0 : (LETTER_TO_VISEME[base(ch)] ?? 1);
    if (out.length && out[out.length - 1].viseme === v) return;
    out.push({ t_ms: Math.floor(i * step), viseme: v });
  });
  out.push({ t_ms: durationMs, viseme: 0 });
  return out;
}

export const clampViseme = (v: number) => Math.max(VISEME_MIN, Math.min(VISEME_MAX, Math.trunc(v)));

/** Aktuelles Viseme zum Zeitpunkt t (binaere Suche im sortierten Zeitstrahl). */
export function visemeAt(timeline: VisemeEvent[], tMs: number): number {
  if (!timeline.length || tMs < timeline[0].t_ms) return 0;
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid].t_ms <= tMs) lo = mid; else hi = mid - 1;
  }
  return clampViseme(timeline[lo].viseme);
}

/** Grobe Mundoeffnung 0..1 je Viseme fuer den Platzhalter-Avatar (Rive-Avatar nutzt direkt die ID). */
export const MOUTH_OPEN: number[] = [0, 0.5, 1, 0.8, 0.45, 0.4, 0.2, 0.3, 0.65, 0.9, 0.7, 0.85, 0.35, 0.3, 0.4, 0.15, 0.25, 0.25, 0.1, 0.3, 0.35, 0.02];

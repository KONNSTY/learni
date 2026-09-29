// Avatar-Paket = .riv + manifest.json (Vertrag: packages/contracts/schemas/avatar-manifest.schema.json).
import type { Emotion } from "../events/types";

export const EMOTIONS: Emotion[] = ["neutral", "happy", "encouraging", "thinking", "surprised", "sad", "celebrate"];
export interface AvatarManifest {
  manifest_version: "1.0.0"; id: string; name: string; riv_file: string; state_machine: string;
  inputs: { viseme: { name: string; min: 0; max: 21 }; emotion: { name: string; values: Emotion[] }; gaze_x: { name: string }; gaze_y: { name: string }; speaking: { name: string } };
  outfit_slots?: { slot: "hat" | "glasses" | "top" | "background"; input: string; variants?: number }[];
  license?: string;
}

/** Prueft ein geladenes Manifest gegen den festen Input-Vertrag (ohne Schema-Bibliothek zur Laufzeit). */
export function validateManifest(m: unknown): m is AvatarManifest {
  const x = m as AvatarManifest;
  if (!x || x.manifest_version !== "1.0.0" || !/^[a-z0-9_-]+$/.test(x.id ?? "") || !/\.riv$/.test(x.riv_file ?? "")) return false;
  const i = x.inputs;
  if (!i || i.viseme?.min !== 0 || i.viseme?.max !== 21 || !i.gaze_x?.name || !i.gaze_y?.name || !i.speaking?.name) return false;
  const v = i.emotion?.values;
  return Array.isArray(v) && v.length === 7 && new Set(v).size === 7 && v.every((e) => EMOTIONS.includes(e));
}

export const placeholderManifest: AvatarManifest = {
  manifest_version: "1.0.0", id: "placeholder", name: "Platzhalter-Avatar (2D)", riv_file: "placeholder.riv", state_machine: "Avatar",
  inputs: { viseme: { name: "viseme", min: 0, max: 21 }, emotion: { name: "emotion", values: EMOTIONS }, gaze_x: { name: "gazeX" }, gaze_y: { name: "gazeY" }, speaking: { name: "speaking" } },
  outfit_slots: [{ slot: "hat", input: "outfitHat", variants: 3 }, { slot: "glasses", input: "outfitGlasses", variants: 2 }, { slot: "top", input: "outfitTop", variants: 4 }, { slot: "background", input: "outfitBackground", variants: 3 }],
  license: "CC0-1.0",
};

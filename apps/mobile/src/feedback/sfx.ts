import type { SfxName } from "./feedbackMap";

// Vorgeladene Player; Ausloesung < 100-200 ms. Native Module sind optional (Expo Go / Tests ohne Audio).
const sources: Record<SfxName, number> = {
  tap: require("../../assets/sfx/tap.wav"),
  correct: require("../../assets/sfx/correct.wav"),
  wrong: require("../../assets/sfx/wrong.wav"),
  lesson_complete: require("../../assets/sfx/lesson_complete.wav"),
  streak: require("../../assets/sfx/streak.wav"),
  level_up: require("../../assets/sfx/level_up.wav"),
  hearts_empty: require("../../assets/sfx/hearts_empty.wav"),
  heart_break: require("../../assets/sfx/heart_break.wav"),
  mic_on: require("../../assets/sfx/mic_on.wav"),
  mic_off: require("../../assets/sfx/mic_off.wav"),
};

type Player = { play(): void; seekTo(s: number): Promise<void>; volume: number; release?: () => void; remove?: () => void };
const players = new Map<SfxName, Player>();
let ready = false;

export async function preloadSfx(): Promise<void> {
  if (ready) return;
  try {
    const audio = require("expo-audio") as typeof import("expo-audio");
    // playsInSilentMode:false => Systemstummschalter wird respektiert; mixWithOthers => keine Unterbrechung fremder Audios.
    await audio.setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", allowsRecording: false, shouldPlayInBackground: false });
    for (const [name, src] of Object.entries(sources) as [SfxName, number][]) {
      const p = audio.createAudioPlayer(src) as unknown as Player;
      p.volume = name === "tap" ? 0.5 : 0.8;
      players.set(name, p);
    }
    ready = true;
  } catch {
    ready = true; // Audio nicht verfuegbar: still weiterlaufen
  }
}

export function playSfx(name: SfxName): void {
  const p = players.get(name);
  if (!p) return;
  try { void p.seekTo(0); p.play(); } catch { /* ignorieren */ }
}

export function releaseSfx(): void {
  for (const p of players.values()) { try { (p.release ?? p.remove)?.call(p); } catch { /* */ } }
  players.clear(); ready = false;
}

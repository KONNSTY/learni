import type { EventType, LearniEvent } from "../events/types";

export type SfxName = "tap" | "correct" | "wrong" | "lesson_complete" | "streak" | "level_up" | "hearts_empty" | "heart_break" | "mic_on" | "mic_off";
export type HapticKind = "light" | "soft" | "medium" | "heavy" | "success" | "error" | "none";
export type AnimationName = "pop" | "shake" | "confetti_small" | "confetti_big" | "heart_break" | "heart_pulse" | "xp_count" | "flame_pulse" | "badge_zoom" | "none";

export interface Feedback { sfx?: SfxName; haptic: HapticKind; animation: AnimationName }

/** Tabelle Haptik/Sound/Motion (Figma-Seite "Prototype & Sound"; Spec 7 [ANNAHME]). Backend liefert nur Semantik. */
export function feedbackFor(e: LearniEvent): Feedback | null {
  switch (e.type) {
    case "answer.evaluated":
      if (e.payload.correct) return { sfx: "correct", haptic: "success", animation: "confetti_small" };
      // Sprechfehler: sanft, kein Herzbruch
      return e.payload.decidable
        ? { sfx: "wrong", haptic: "error", animation: "shake" }
        : { haptic: "soft", animation: "none" };
    case "hearts.changed": return { haptic: "none", animation: "heart_pulse" };
    case "hearts.empty": return { sfx: "hearts_empty", haptic: "medium", animation: "heart_break" };
    case "reward.granted":
      if (e.payload.kind === "xp") return { haptic: "none", animation: "xp_count" };
      if (e.payload.kind === "heart") return { sfx: "correct", haptic: "soft", animation: "heart_pulse" };
      return { sfx: "level_up", haptic: "success", animation: "badge_zoom" };
    case "lesson.completed": return { sfx: "lesson_complete", haptic: "heavy", animation: "confetti_big" };
    case "streak.updated": return e.payload.freeze_used || e.payload.days > 0 ? { sfx: "streak", haptic: "soft", animation: "flame_pulse" } : null;
    case "level.up": return { sfx: "level_up", haptic: "heavy", animation: "badge_zoom" };
    case "daily_goal.reached": return { sfx: "streak", haptic: "success", animation: "confetti_small" };
    default: return null;
  }
}

/** Heart-Verlust ergibt zusaetzlich den Bruch-Sound. */
export function extraFor(e: LearniEvent): Feedback | null {
  if (e.type === "answer.evaluated" && e.payload.hearts_lost > 0) return { sfx: "heart_break", haptic: "medium", animation: "heart_break" };
  return null;
}

export const TAP: Feedback = { sfx: "tap", haptic: "light", animation: "pop" };
export const MIC_ON: Feedback = { sfx: "mic_on", haptic: "medium", animation: "pop" };
export const MIC_OFF: Feedback = { sfx: "mic_off", haptic: "light", animation: "none" };

/** Nutzer-Einstellungen + Reduce Motion filtern das Feedback (getrennte Schalter). */
export interface FeedbackPrefs { sfx: boolean; haptics: boolean; reduceMotion: boolean; systemMuted: boolean }
export function applyPrefs(f: Feedback, p: FeedbackPrefs): Feedback {
  return {
    sfx: p.sfx && !p.systemMuted ? f.sfx : undefined,
    haptic: p.haptics ? f.haptic : "none",
    animation: p.reduceMotion ? "none" : f.animation,
  };
}

export const HANDLED_EVENTS: EventType[] = ["answer.evaluated", "hearts.changed", "hearts.empty", "reward.granted", "lesson.completed", "streak.updated", "level.up", "daily_goal.reached"];

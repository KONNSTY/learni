// Semantische Events (Contract: packages/contracts/schemas/events.schema.json). Keine UI-Anweisungen:
// Aussehen, Klang und Haptik entscheidet allein das Frontend (feedback/feedbackMap.ts).
export type Emotion = "neutral" | "happy" | "encouraging" | "thinking" | "surprised" | "sad" | "celebrate";
export type PaywallTrigger = "hearts_empty" | "ai_minutes_exhausted" | "pro_feature" | "streak_at_risk" | "onboarding_plan";

export interface EventPayloads {
  "answer.evaluated": { exercise_id: string; correct: boolean; decidable: boolean; hearts_lost: number; feedback_key: string; correct_answer?: string | string[] | null; pronunciation_score?: number | null };
  "reward.granted": { kind: "xp" | "heart" | "streak_freeze" | "trophy"; amount: number; reason?: string; trophy_id?: string };
  "hearts.changed": { hearts: number; max_hearts: number | null; unlimited?: boolean };
  "hearts.empty": { paywall_trigger?: "hearts_empty" };
  "streak.updated": { days: number; freeze_used: boolean; at_risk?: boolean };
  "level.up": { language: string; level: string; skill?: string };
  "daily_goal.reached": { xp: number };
  "lesson.completed": { xp_gained: number; mistakes: number; minutes: number };
  "avatar.speak": { text: string; audio_url: string | null; visemes: { t_ms: number; viseme: number }[]; emotion: Emotion; mock?: boolean };
  "budget.limited": { reason: "ai_minutes" | "cost_cents" | "fair_use"; fallback: "cached_content"; paywall_trigger?: string | null };
  "paywall.requested": { trigger: PaywallTrigger };
  "membership.changed": { tier: "free" | "pro"; status: string };
}

export type EventType = keyof EventPayloads;
export type LearniEvent<T extends EventType = EventType> = {
  [K in T]: { event_version: "1.0.0"; type: K; ts: string; payload: EventPayloads[K] };
}[T];

/** Muss zu den `const`-Typen in events.schema.json passen (Paritaetstest in tests/contracts.test.ts). */
export const EVENT_TYPES: EventType[] = [
  "answer.evaluated", "reward.granted", "hearts.changed", "hearts.empty", "streak.updated", "level.up",
  "daily_goal.reached", "lesson.completed", "avatar.speak", "budget.limited", "paywall.requested", "membership.changed",
];

export function isEvent(x: unknown): x is LearniEvent {
  const e = x as { event_version?: unknown; type?: unknown; payload?: unknown };
  return !!e && e.event_version === "1.0.0" && typeof e.type === "string" && (EVENT_TYPES as string[]).includes(e.type) && typeof e.payload === "object" && e.payload !== null;
}

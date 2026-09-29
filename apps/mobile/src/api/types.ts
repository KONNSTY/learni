import type { LearniEvent, PaywallTrigger } from "../events/types";
import type { Exercise } from "../contracts/generated/schemas";

export type { Exercise };
export type Level = "A1" | "A2" | "B1" | "B2";
export type Tier = "free" | "pro";

export interface Language { code: string; name: string; native_name: string; tier: "A" | "B" | "C"; badge: string; region_variants?: string[] }
export interface Settings { avatar_voice: boolean; sfx: boolean; haptics: boolean; show_translation: boolean; auto_vad: boolean }
export interface Consents { voice_processing: boolean; personalized_ads: boolean; analytics: boolean }
export interface Profile { user_id: string; display_name: string | null; native_language: string; ui_language: "de" | "en"; age_bracket: string | null; settings: Settings; consents: Consents }
export interface Membership { tier: Tier; status: string; trial?: boolean; expires_at?: string | null; source?: string }
export interface LearningState {
  language: string; level: Level; goal: string; daily_goal_minutes: number; daily_xp: number; daily_xp_target: number; xp: number;
  streak_days: number; streak_freezes: number; hearts: number; max_hearts: number | null; unlimited_hearts: boolean; trophies: string[]; skills: Record<string, number>;
}
export interface Budget { ai_seconds_used: number; ai_seconds_limit: number; cost_cents_used: number; cost_cents_limit: number; limited: boolean }
export interface UserState { profile: Profile; membership: Membership; learning: LearningState; budget?: Budget }
export interface LearningPlan { language: string; level: Level; weeks_to_next_level: number; daily_goal_minutes: number; topics: string[]; paywall_trigger: "onboarding_plan" }
export interface OnboardingInput { language: string; self_level: "none" | "few_words" | "simple_conversations" | "everyday"; adaptive_answers: { item_id: string; correct: boolean }[]; goal: "travel" | "work" | "family" | "fun"; daily_goal_minutes: 5 | 10 | 15 | 20 }
export interface NextExercise { exercise: Exercise; events: LearniEvent[]; test_mode?: boolean }
export interface AnswerInput { language: string; answer: string | string[]; response_ms?: number; pronunciation_score?: number }
export interface VoiceTurnInput { language: string; audio_b64?: string; audio_seconds?: number; audio_mime?: string; text?: string; slow?: boolean; exercise_id?: string; scenario_id?: string }
export interface VoiceTurnResult { transcript: string; events: LearniEvent[]; latency_ms: Record<string, number>; test_mode?: boolean; tutor_turn?: Exercise; pronunciation?: { overall: number; words: { word: string; score: number | null }[] } }
export interface TutorProfile { language: string; goals: string[]; interests: string[]; typical_mistakes: string[]; pace: string }
export interface RemoteConfig { pricing: { currency: string; monthly: number; yearly: number; trial_days: number }; free: { max_hearts: number; ai_seconds_per_day: number }; pro: { ai_seconds_per_day: number }; feature_flags: Record<string, boolean> }

export interface LearniApi {
  readonly mode: "mock" | "http";
  config(): Promise<RemoteConfig>;
  languages(): Promise<Language[]>;
  sync(input: { native_language?: string; ui_language?: "de" | "en"; display_name?: string; region?: string }): Promise<UserState>;
  patchProfile(patch: Partial<Pick<Profile, "display_name" | "age_bracket" | "ui_language">> & { settings?: Partial<Settings>; consents?: Partial<Consents> }): Promise<Profile>;
  onboarding(input: OnboardingInput): Promise<LearningPlan>;
  state(language: string): Promise<UserState>;
  nextExercise(language: string, mode?: "curriculum" | "conversation"): Promise<NextExercise>;
  answer(exerciseId: string, input: AnswerInput): Promise<LearniEvent[]>;
  completeLesson(input: { language: string; xp: number; mistakes: number; minutes: number }): Promise<LearniEvent[]>;
  rewardedAd(language: string): Promise<LearniEvent[]>;
  voiceTurn(input: VoiceTurnInput): Promise<VoiceTurnResult>;
  tutorProfile(language: string): Promise<TutorProfile>;
  deleteTutorProfile(language: string): Promise<void>;
  exportData(): Promise<Record<string, unknown>>;
  deleteAccount(): Promise<void>;
  devSetTier(tier: Tier): Promise<UserState>;
  track(name: string, props?: Record<string, string | number | boolean | null>, language?: string): Promise<void>;
}

export class ApiError extends Error {
  constructor(public status: number, public detail: string) { super(`${status}: ${detail}`); }
}
export type { PaywallTrigger };

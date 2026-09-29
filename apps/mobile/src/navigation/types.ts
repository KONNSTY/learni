import type { PaywallTrigger } from "../events/types";

export type Celebration = { kind: "streak"; value: number } | { kind: "levelup"; value: string };
export type RootStackParamList = {
  Login: undefined;
  AiNotice: undefined;
  Language: { mode?: "switch" } | undefined;
  AgeGate: undefined;
  Consent: { mode?: "settings" | "voice" } | undefined;
  Onboarding: undefined;
  Plan: undefined;
  Main: undefined;
  Profile: undefined;
  Paywall: { trigger: PaywallTrigger };
  PronReport: { score: number; words: { word: string; score: number | null }[] };
  LessonEnd: { xp: number; mistakes: number; minutes: number; then: Celebration[] };
  Celebration: { items: Celebration[] };
  DeleteAccount: undefined;
  TutorProfile: undefined;
};

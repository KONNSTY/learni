import { useSyncExternalStore } from "react";
import type { LearniApi, Language, LearningPlan, RemoteConfig, UserState } from "../api/types";
import type { PaywallTrigger } from "../events/types";

export interface LessonStats { answered: number; mistakes: number; xp: number; startedAt: number | null }
export interface AppData {
  booted: boolean;
  api: LearniApi | null;
  signedIn: boolean;
  languages: Language[];
  config: RemoteConfig | null;
  user: UserState | null;
  language: string | null;
  plan: LearningPlan | null;
  onboarded: boolean;
  consentDone: boolean;
  aiNoticeAck: boolean;
  offline: boolean;
  paywall: PaywallTrigger | null;
  lesson: LessonStats;
  testMode: boolean;
  budgetLimited: boolean;
  lastError: string | null;
}

export const initialData = (): AppData => ({
  booted: false, api: null, signedIn: false, languages: [], config: null, user: null, language: null, plan: null, onboarded: false,
  consentDone: false, aiNoticeAck: false, offline: false, paywall: null, lesson: { answered: 0, mistakes: 0, xp: 0, startedAt: null }, testMode: false, budgetLimited: false, lastError: null,
});

/** Winziger externer Store (kein Zusatzpaket). */
export function createStore<T extends object>(init: () => T) {
  let state = init();
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T> | ((s: T) => Partial<T>)) => { state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) }; subs.forEach((f) => f()); },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
    reset: () => { state = init(); subs.forEach((f) => f()); },
  };
}

export const appStore = createStore<AppData>(initialData);

export function useApp<T>(selector: (s: AppData) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.get()), () => selector(appStore.get()));
}

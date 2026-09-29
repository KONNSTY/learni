import { createHttpApi } from "../api/http";
import { ApiError, type AnswerInput, type Exercise, type LearniApi, type OnboardingInput, type Profile, type Tier } from "../api/types";
import { createAds, type Ads } from "../ads";
import { getToken, hasSession, signIn as authSignIn, signOut as authSignOut, wipeLocalSession, type Provider } from "../auth/session";
import { env } from "../config/env";
import { bus } from "../events/bus";
import { detectLocale } from "../i18n";
import { createLocalApi } from "../mock/localApi";
import { shouldShowPaywall } from "../paywall/triggers";
import { createPurchases, type Purchases } from "../purchases";
import { appStore, initialData } from "./store";
import { asyncKV, clearPrefs, loadPrefs, savePrefs, type Prefs } from "./prefs";

let purchases: Purchases | null = null;
let ads: Ads | null = null;
let paywallHistory: Record<string, number> = {};
let speakingNow = false;
export const setSpeaking = (v: boolean) => { speakingNow = v; };

const api = () => { const a = appStore.get().api; if (!a) throw new Error("app not booted"); return a; };
export const getAds = () => (ads ??= createAds());
export const getPurchases = () => { if (!purchases) throw new Error("app not booted"); return purchases; };

function fail(e: unknown): never {
  const offline = e instanceof ApiError && e.status === 0;
  appStore.set({ offline, lastError: e instanceof ApiError ? e.detail : "error" });
  throw e;
}
async function guard<T>(p: Promise<T>): Promise<T> { try { const r = await p; if (appStore.get().offline) appStore.set({ offline: false }); return r; } catch (e) { return fail(e); } }

let wired = false;
function wireBus() {
  if (wired) return; wired = true;
  bus.on("paywall.requested", (e) => {
    const tier = appStore.get().user?.membership.tier ?? "free";
    if (shouldShowPaywall(e.payload.trigger, tier, paywallHistory, Date.now(), speakingNow)) {
      paywallHistory = { ...paywallHistory, [e.payload.trigger]: Date.now() }; void savePrefs({ paywallHistory });
      appStore.set({ paywall: e.payload.trigger });
    }
  });
  bus.on("budget.limited", () => appStore.set({ budgetLimited: true }));
  bus.on("membership.changed", () => { void refreshState(); });
}

export async function boot(): Promise<void> {
  wireBus();
  const prefs = await loadPrefs();
  paywallHistory = prefs.paywallHistory;
  const client: LearniApi = env.apiMode === "http" && env.apiUrl ? createHttpApi(env.apiUrl, getToken) : createLocalApi({ kv: asyncKV });
  appStore.set({ api: client, language: prefs.language, onboarded: prefs.onboarded, consentDone: prefs.consentDone, aiNoticeAck: prefs.aiNoticeAck, testMode: client.mode === "mock" });
  purchases = createPurchases(client, refreshState);
  try {
    const [languages, config] = await Promise.all([client.languages(), client.config()]);
    appStore.set({ languages, config });
  } catch (e) { appStore.set({ offline: e instanceof ApiError && e.status === 0 }); }
  if (await hasSession()) { try { await afterSignIn(); } catch { /* offline: spaeter erneut */ } }
  appStore.set({ booted: true });
}

async function afterSignIn(): Promise<void> {
  const user = await guard(api().sync({ native_language: detectLocale(), ui_language: detectLocale() }));
  await purchases?.init(user.profile.user_id);
  appStore.set({ user, signedIn: true, testMode: api().mode === "mock" || appStore.get().testMode });
  const lang = appStore.get().language;
  if (lang) await refreshState();
}

export async function signIn(provider: Provider, email?: string): Promise<"ok" | "emailSent" | "failed"> {
  const r = await authSignIn(provider, email);
  if (!r.ok) return "failed";
  if (r.message === "emailSent") return "emailSent";
  await afterSignIn();
  return "ok";
}

export async function refreshState(): Promise<void> {
  const lang = appStore.get().language;
  if (!lang) return;
  const user = await guard(api().state(lang));
  appStore.set({ user, budgetLimited: !!user.budget?.limited });
}

export async function chooseLanguage(code: string): Promise<void> {
  appStore.set({ language: code });
  await savePrefs({ language: code });
  await refreshState();
}

export async function patchProfile(patch: Parameters<LearniApi["patchProfile"]>[0]): Promise<Profile> {
  const p = await guard(api().patchProfile(patch));
  appStore.set((s) => ({ user: s.user ? { ...s.user, profile: p } : s.user }));
  return p;
}

export async function finishConsent(consents: { voice_processing: boolean; personalized_ads: boolean; analytics: boolean }): Promise<void> {
  await patchProfile({ consents });
  appStore.set({ consentDone: true }); await savePrefs({ consentDone: true });
  void getAds().init({ ageBracket: appStore.get().user?.profile.age_bracket ?? null, personalizedConsent: consents.personalized_ads });
}
export async function ackAiNotice(): Promise<void> { appStore.set({ aiNoticeAck: true }); await savePrefs({ aiNoticeAck: true }); }

export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const plan = await guard(api().onboarding(input));
  appStore.set({ plan, language: input.language });
  await savePrefs({ language: input.language });
  await refreshState();
}
export async function finishOnboarding(): Promise<void> { appStore.set({ onboarded: true }); await savePrefs({ onboarded: true }); }

export async function nextExercise(mode: "curriculum" | "conversation" = "curriculum"): Promise<Exercise> {
  const lang = appStore.get().language!;
  const r = await guard(api().nextExercise(lang, mode));
  bus.emitAll(r.events);
  if (r.test_mode) appStore.set({ testMode: true });
  return r.exercise;
}

export async function submitAnswer(id: string, input: Omit<AnswerInput, "language">) {
  const lang = appStore.get().language!;
  const events = await guard(api().answer(id, { language: lang, ...input }));
  bus.emitAll(events);
  const ae = events.find((e) => e.type === "answer.evaluated");
  const gained = events.filter((e) => e.type === "reward.granted" && e.payload.kind === "xp").reduce((n, e) => n + (e.type === "reward.granted" ? e.payload.amount : 0), 0);
  appStore.set((s) => ({ lesson: { ...s.lesson, answered: s.lesson.answered + 1, mistakes: s.lesson.mistakes + (ae && ae.type === "answer.evaluated" && !ae.payload.correct && ae.payload.decidable ? 1 : 0), xp: s.lesson.xp + gained, startedAt: s.lesson.startedAt ?? Date.now() } }));
  await refreshState();
  return events;
}

export function startLesson() { appStore.set({ lesson: { answered: 0, mistakes: 0, xp: 0, startedAt: Date.now() } }); }
export async function finishLesson() {
  const { lesson, language } = appStore.get();
  const minutes = Math.max(0.1, Math.round(((Date.now() - (lesson.startedAt ?? Date.now())) / 60000) * 10) / 10);
  const events = await guard(api().completeLesson({ language: language!, xp: Math.min(lesson.xp, 500), mistakes: lesson.mistakes, minutes: Math.min(minutes, 120) }));
  bus.emitAll(events);
  await refreshState();
  return { events, stats: { ...lesson, minutes } };
}

export async function watchRewardedAd(): Promise<boolean> {
  const earned = await getAds().showRewarded();
  if (!earned) return false;
  const events = await guard(api().rewardedAd(appStore.get().language!));
  bus.emitAll(events);
  await refreshState();
  return true;
}

export async function buyPro(plan: "monthly" | "yearly") {
  const r = await getPurchases().purchase(plan);
  if (r.pro) void api().track("trial_start", { plan }, appStore.get().language ?? undefined).catch(() => {});
  return r;
}
export async function restorePurchases() { return getPurchases().restore(); }
export async function devSetTier(tier: Tier) { await guard(api().devSetTier(tier)); await refreshState(); }
export const dismissPaywall = () => appStore.set({ paywall: null });
export const showPaywall = (trigger: NonNullable<ReturnType<typeof appStore.get>["paywall"]>) => appStore.set({ paywall: trigger });

export async function signOut() { await authSignOut(); appStore.set({ signedIn: false, user: null }); }
export async function deleteAccount() {
  await guard(api().deleteAccount());
  await wipeLocalSession();
  await clearPrefs();
  const keep = { booted: true, api: appStore.get().api, languages: appStore.get().languages, config: appStore.get().config };
  appStore.reset();
  appStore.set(keep);
  paywallHistory = {};
}
export async function loadThemePrefs(): Promise<Prefs["themeMode"]> { return (await loadPrefs()).themeMode; }
export const saveThemeMode = (m: Prefs["themeMode"]) => savePrefs({ themeMode: m });
export { initialData };

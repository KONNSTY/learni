import type { Tier } from "../api/types";

export interface AdContext { tier: Tier; ageBracket: string | null; speaking: boolean; inLesson: boolean; personalizedConsent: boolean }
export const isMinor = (age: string | null) => age === "under_16" || age === "16_17";

/** Werbung: nie fuer Pro, nie im Sprechfluss oder mitten in der Lektion. Minderjaehrige: nur nicht-personalisiert. */
export function canShowInterstitial(c: AdContext): boolean { return c.tier === "free" && !c.speaking && !c.inLesson; }
export function requestConfig(c: Pick<AdContext, "ageBracket" | "personalizedConsent">) {
  const minor = isMinor(c.ageBracket) || c.ageBracket === null; // unbekanntes Alter: vorsichtig behandeln
  return { requestNonPersonalizedAdsOnly: minor || !c.personalizedConsent, tagForUnderAgeOfConsent: isMinor(c.ageBracket) };
}

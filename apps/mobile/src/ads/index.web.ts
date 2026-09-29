import type { Ads } from "./types";

/** Web (Entwicklungs-/E2E-Vorschau): keine Native-Ads, Mock. */
export function createAds(): Ads {
  return { mock: true, async init() {}, async showRewarded() { await new Promise((r) => setTimeout(r, 300)); return true; }, async showInterstitial() {} };
}
export type { Ads } from "./types";

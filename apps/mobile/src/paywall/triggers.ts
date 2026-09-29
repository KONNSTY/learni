import type { PaywallTrigger } from "../events/types";
import type { Tier } from "../api/types";

/** Paywall-Trigger (Spec 4.2 [ANNAHME]). Backend entscheidet WANN (paywall.requested), das Frontend nur ob/wie es gezeigt wird. */
export const ALL_TRIGGERS: PaywallTrigger[] = ["hearts_empty", "ai_minutes_exhausted", "pro_feature", "streak_at_risk", "onboarding_plan"];

const COOLDOWN_MS: Record<PaywallTrigger, number> = {
  hearts_empty: 10 * 60_000, ai_minutes_exhausted: 30 * 60_000, pro_feature: 5 * 60_000, streak_at_risk: 6 * 3_600_000, onboarding_plan: Infinity,
};

export interface PaywallHistory { [trigger: string]: number }

export function shouldShowPaywall(trigger: PaywallTrigger, tier: Tier, history: PaywallHistory, now: number, speaking = false): boolean {
  if (tier === "pro") return false;
  if (speaking) return false; // nie mitten im Sprechfluss (der Aufrufer merkt sich die Anfrage und zeigt sie nach dem Sprechen)
  const last = history[trigger];
  return last === undefined || now - last >= COOLDOWN_MS[trigger];
}

/** hearts_empty bietet "Sprechen üben" und eine freiwillige Rewarded Ad an; alle anderen nur Trial/Später. */
export const offersRewardedAd = (t: PaywallTrigger) => t === "hearts_empty";
export const paywallKeys = (t: PaywallTrigger) => ({ title: `paywall.${t}.title`, body: `paywall.${t}.body` }) as const;

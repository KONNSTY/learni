import type { LearniApi } from "../api/types";
import type { Purchases } from "./types";

export type { Plan, PurchaseResult, Purchases } from "./types";
/** Web (Vorschau): Sandbox-Mock, schaltet Pro ueber die API (nur Dev/Mock). */
export function createPurchases(api: LearniApi, onTierChanged: () => Promise<void>): Purchases {
  return { sandbox: true, async init() {}, async purchase() { await api.devSetTier("pro"); await onTierChanged(); return { pro: true, cancelled: false }; }, async restore() { return false; } };
}

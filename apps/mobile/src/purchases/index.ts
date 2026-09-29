import { Platform } from "react-native";
import { env } from "../config/env";
import type { LearniApi } from "../api/types";

export type Plan = "monthly" | "yearly";
export interface PurchaseResult { pro: boolean; cancelled: boolean }
export interface Purchases {
  readonly sandbox: boolean;
  init(userId: string): Promise<void>;
  purchase(plan: Plan): Promise<PurchaseResult>;
  restore(): Promise<boolean>;
}
const ENTITLEMENT = "pro";
type RC = typeof import("react-native-purchases").default;

function loadRc(): RC | null { try { return (require("react-native-purchases") as { default: RC }).default; } catch { return null; } }

/** RevenueCat (StoreKit 2 / Play Billing), Entitlement `pro`. Ohne Key oder ohne Native-Modul: Sandbox-Mock schaltet Free/Pro im Test. */
export function createPurchases(api: LearniApi, onTierChanged: () => Promise<void>): Purchases {
  const key = Platform.OS === "ios" ? env.revenueCatIosKey : env.revenueCatAndroidKey;
  const rc = key ? loadRc() : null;
  if (!rc) {
    return {
      sandbox: true,
      async init() { /* nichts */ },
      async purchase() { await api.devSetTier("pro"); await onTierChanged(); return { pro: true, cancelled: false }; },
      async restore() { return false; },
    };
  }
  return {
    sandbox: false,
    async init(userId) { rc.configure({ apiKey: key, appUserID: userId }); },
    async purchase(plan) {
      try {
        const offerings = await rc.getOfferings();
        const pkg = plan === "yearly" ? offerings.current?.annual : offerings.current?.monthly;
        if (!pkg) return { pro: false, cancelled: false };
        const { customerInfo } = await rc.purchasePackage(pkg);
        const pro = !!customerInfo.entitlements.active[ENTITLEMENT];
        if (pro) await onTierChanged(); // Backend-Status kommt per RevenueCat-Webhook; hier nur neu laden
        return { pro, cancelled: false };
      } catch (e) {
        return { pro: false, cancelled: !!(e as { userCancelled?: boolean }).userCancelled };
      }
    },
    async restore() {
      try { const info = await rc.restorePurchases(); const pro = !!info.entitlements.active[ENTITLEMENT]; if (pro) await onTierChanged(); return pro; } catch { return false; }
    },
  };
}

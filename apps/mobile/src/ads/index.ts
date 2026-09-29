import { Platform } from "react-native";
import { env } from "../config/env";
import { requestConfig, type AdContext } from "./policy";

export interface Ads {
  readonly mock: boolean;
  /** ATT (iOS) -> UMP/TCF (EU) -> SDK-Init. Idempotent. */
  init(ctx: Pick<AdContext, "ageBracket" | "personalizedConsent">): Promise<void>;
  /** Freiwillige Rewarded Ad. true = Belohnung verdient. */
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
}
type Gma = typeof import("react-native-google-mobile-ads");
const load = (): Gma | null => { try { return require("react-native-google-mobile-ads") as Gma; } catch { return null; } };

export function createAds(): Ads {
  const gma = Platform.OS === "ios" || Platform.OS === "android" ? load() : null;
  if (!gma) {
    // Expo Go / Web: Mock
    return { mock: true, async init() {}, async showRewarded() { await new Promise((r) => setTimeout(r, 800)); return true; }, async showInterstitial() {} };
  }
  let inited = false;
  return {
    mock: false,
    async init(ctx) {
      if (inited) return;
      inited = true;
      try {
        if (Platform.OS === "ios") {
          const att = require("expo-tracking-transparency") as typeof import("expo-tracking-transparency");
          if (!ctx.ageBracket || ctx.ageBracket === "18_plus") await att.requestTrackingPermissionsAsync();
        }
        await gma.AdsConsent.gatherConsent(); // Google UMP (TCF) in der EU/UK
        await gma.default().setRequestConfiguration({ ...requestConfig(ctx), maxAdContentRating: gma.MaxAdContentRating.PG });
        await gma.default().initialize();
      } catch { inited = false; }
    },
    showRewarded() {
      return new Promise<boolean>((resolve) => {
        const unit = __DEV__ || !env.admobRewardedIos ? gma.TestIds.REWARDED : env.admobRewardedIos; // Testanzeigen im Dev, echte IDs per Env
        const ad = gma.RewardedAd.createForAdRequest(unit);
        let earned = false;
        const unsubs = [
          ad.addAdEventListener(gma.RewardedAdEventType.LOADED, () => ad.show().catch(() => resolve(false))),
          ad.addAdEventListener(gma.RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
          ad.addAdEventListener(gma.AdEventType.CLOSED, () => { unsubs.forEach((u) => u()); resolve(earned); }),
          ad.addAdEventListener(gma.AdEventType.ERROR, () => { unsubs.forEach((u) => u()); resolve(false); }),
        ];
        ad.load();
      });
    },
    showInterstitial() {
      return new Promise<void>((resolve) => {
        const unit = __DEV__ || !env.admobInterstitialIos ? gma.TestIds.INTERSTITIAL : env.admobInterstitialIos;
        const ad = gma.InterstitialAd.createForAdRequest(unit);
        const unsubs = [
          ad.addAdEventListener(gma.AdEventType.LOADED, () => ad.show().catch(() => resolve())),
          ad.addAdEventListener(gma.AdEventType.CLOSED, () => { unsubs.forEach((u) => u()); resolve(); }),
          ad.addAdEventListener(gma.AdEventType.ERROR, () => { unsubs.forEach((u) => u()); resolve(); }),
        ];
        ad.load();
      });
    },
  };
}

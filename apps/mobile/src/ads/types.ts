import type { AdContext } from "./policy";

export interface Ads {
  readonly mock: boolean;
  /** ATT (iOS) -> UMP/TCF (EU) -> SDK-Init. Idempotent. */
  init(ctx: Pick<AdContext, "ageBracket" | "personalizedConsent">): Promise<void>;
  /** Freiwillige Rewarded Ad. true = Belohnung verdient. */
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
}

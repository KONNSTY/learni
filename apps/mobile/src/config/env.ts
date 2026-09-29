// Nur oeffentliche Werte (EXPO_PUBLIC_*). Niemals Service-Role-, LLM-, STT-, TTS- oder RevenueCat-Secrets hierher.
const e = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

export const env = {
  apiUrl: e.EXPO_PUBLIC_API_URL ?? "",
  apiMode: (e.EXPO_PUBLIC_API_MODE as "mock" | "http" | undefined) ?? (e.EXPO_PUBLIC_API_URL ? "http" : "mock"),
  supabaseUrl: e.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: e.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  revenueCatIosKey: e.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  revenueCatAndroidKey: e.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  admobIosAppId: e.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? "",
  admobRewardedIos: e.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? "",
  admobInterstitialIos: e.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? "",
};
export const hasSupabase = () => !!env.supabaseUrl && !!env.supabaseAnonKey;

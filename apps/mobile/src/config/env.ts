// Nur oeffentliche Werte (EXPO_PUBLIC_*). Niemals Service-Role-, LLM-, STT-, TTS- oder RevenueCat-Secrets hierher.
const e = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

/** Release-Sicherheit: Mock-Modus (lokales Konto, Pro-Umschalter) gibt es nur in Debug-Builds. Ein Release-Build ohne Backend-URL
 *  faellt NICHT still in den Mock, sondern bleibt im http-Modus (und zeigt Verbindungsfehler). Ausnahme nur bewusst per EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE=true. */
export function resolveApiMode(vars: { mode?: string; url?: string; allowMock?: string }, dev: boolean): "mock" | "http" {
  const mockAllowed = dev || vars.allowMock === "true";
  if (vars.mode === "http") return "http";
  if (vars.mode === "mock") return mockAllowed ? "mock" : "http";
  return vars.url ? "http" : mockAllowed ? "mock" : "http";
}
const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : true;
export const mockAllowed = isDev || e.EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE === "true";

export const env = {
  apiUrl: e.EXPO_PUBLIC_API_URL ?? "",
  apiMode: resolveApiMode({ mode: e.EXPO_PUBLIC_API_MODE, url: e.EXPO_PUBLIC_API_URL, allowMock: e.EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE }, isDev),
  supabaseUrl: e.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: e.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  revenueCatIosKey: e.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  revenueCatAndroidKey: e.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "",
  admobIosAppId: e.EXPO_PUBLIC_ADMOB_IOS_APP_ID ?? "",
  admobRewardedIos: e.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? "",
  admobInterstitialIos: e.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? "",
};
export const hasSupabase = () => !!env.supabaseUrl && !!env.supabaseAnonKey;

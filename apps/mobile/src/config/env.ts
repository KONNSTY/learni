// Nur oeffentliche Werte (EXPO_PUBLIC_*). Niemals Service-Role-, LLM-, STT-, TTS- oder RevenueCat-Secrets hierher.
// WICHTIG: Expo ersetzt beim Build nur direkte Zugriffe der Form `process.env.EXPO_PUBLIC_NAME` -> kein Alias, kein dynamischer Key.
const V = {
  API_URL: process.env.EXPO_PUBLIC_API_URL,
  API_MODE: process.env.EXPO_PUBLIC_API_MODE,
  ALLOW_MOCK: process.env.EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE,
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  REVENUECAT_IOS: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  REVENUECAT_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ADMOB_IOS_APP_ID: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
  ADMOB_REWARDED_IOS: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  ADMOB_INTERSTITIAL_IOS: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
};

/** Release-Sicherheit: Mock-Modus (lokales Konto, Pro-Umschalter) gibt es nur in Debug-Builds. Ein Release-Build ohne Backend-URL
 *  faellt NICHT still in den Mock, sondern bleibt im http-Modus (und zeigt Verbindungsfehler). Ausnahme nur bewusst per EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE=true. */
export function resolveApiMode(vars: { mode?: string; url?: string; allowMock?: string }, dev: boolean): "mock" | "http" {
  const mockAllowed = dev || vars.allowMock === "true";
  if (vars.mode === "http") return "http";
  if (vars.mode === "mock") return mockAllowed ? "mock" : "http";
  return vars.url ? "http" : mockAllowed ? "mock" : "http";
}
const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : true;
export const mockAllowed = isDev || V.ALLOW_MOCK === "true";

export const env = {
  apiUrl: V.API_URL ?? "",
  apiMode: resolveApiMode({ mode: V.API_MODE, url: V.API_URL, allowMock: V.ALLOW_MOCK }, isDev),
  supabaseUrl: V.SUPABASE_URL ?? "",
  supabaseAnonKey: V.SUPABASE_ANON_KEY ?? "",
  revenueCatIosKey: V.REVENUECAT_IOS ?? "",
  revenueCatAndroidKey: V.REVENUECAT_ANDROID ?? "",
  admobIosAppId: V.ADMOB_IOS_APP_ID ?? "",
  admobRewardedIos: V.ADMOB_REWARDED_IOS ?? "",
  admobInterstitialIos: V.ADMOB_INTERSTITIAL_IOS ?? "",
};
export const hasSupabase = () => !!env.supabaseUrl && !!env.supabaseAnonKey;

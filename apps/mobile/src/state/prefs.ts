import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "../theme/build";
import type { KV } from "../mock/localApi";

export interface Prefs { language: string | null; onboarded: boolean; consentDone: boolean; aiNoticeAck: boolean; themeMode: ThemeMode; paywallHistory: Record<string, number> }
export const defaultPrefs = (): Prefs => ({ language: null, onboarded: false, consentDone: false, aiNoticeAck: false, themeMode: "system", paywallHistory: {} });
const KEY = "learni.prefs";

export const asyncKV: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

export async function loadPrefs(): Promise<Prefs> {
  try { const raw = await AsyncStorage.getItem(KEY); return { ...defaultPrefs(), ...(raw ? JSON.parse(raw) : {}) }; } catch { return defaultPrefs(); }
}
export async function savePrefs(p: Partial<Prefs>): Promise<void> {
  try { const cur = await loadPrefs(); await AsyncStorage.setItem(KEY, JSON.stringify({ ...cur, ...p })); } catch { /* */ }
}
export const clearPrefs = () => AsyncStorage.removeItem(KEY).catch(() => {});

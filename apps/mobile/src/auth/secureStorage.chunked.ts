// Reine Logik (ohne native Imports) -> testbar.
export interface SecureBackend { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> }
const CHUNK = 1800; // SecureStore-Limit ~2048 Bytes je Wert

/** Supabase-Session ist groesser als das SecureStore-Limit -> in Stuecke teilen. Token nie in AsyncStorage/Logs. */
export function createChunkedStorage(b: SecureBackend) {
  const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");
  return {
    async getItem(key: string): Promise<string | null> {
      const k = safe(key);
      const n = await b.getItemAsync(`${k}.n`);
      if (n === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < Number(n); i++) { const p = await b.getItemAsync(`${k}.${i}`); if (p === null) return null; parts.push(p); }
      return parts.join("");
    },
    async setItem(key: string, value: string): Promise<void> {
      const k = safe(key);
      await this.removeItem(key);
      const parts = value.match(new RegExp(`.{1,${CHUNK}}`, "gs")) ?? [""];
      for (let i = 0; i < parts.length; i++) await b.setItemAsync(`${k}.${i}`, parts[i]);
      await b.setItemAsync(`${k}.n`, String(parts.length));
    },
    async removeItem(key: string): Promise<void> {
      const k = safe(key);
      const n = await b.getItemAsync(`${k}.n`);
      for (let i = 0; i < Number(n ?? 0); i++) await b.deleteItemAsync(`${k}.${i}`);
      await b.deleteItemAsync(`${k}.n`);
    },
  };
}

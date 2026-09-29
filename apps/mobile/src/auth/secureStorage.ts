import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { createChunkedStorage, type SecureBackend } from "./secureStorage.chunked";
export { createChunkedStorage, type SecureBackend };

/** Web-Vorschau (nur Entwicklung/E2E): SecureStore gibt es dort nicht -> localStorage. Auf iOS/Android immer Keychain/Keystore. */
const webBackend = (): SecureBackend => ({
  getItemAsync: async (k) => globalThis.localStorage?.getItem(k) ?? null,
  setItemAsync: async (k, v) => { globalThis.localStorage?.setItem(k, v); },
  deleteItemAsync: async (k) => { globalThis.localStorage?.removeItem(k); },
});
export const secureStorage = createChunkedStorage(Platform.OS === "web" ? webBackend() : (SecureStore as SecureBackend));

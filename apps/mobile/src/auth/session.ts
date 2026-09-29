import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "../config/env";
import { secureStorage } from "./secureStorage";

const DEV_KEY = "learni.dev.userid";
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
  return client;
}

/** Lokales Konto ohne Server (Testmodus). Token `dev:<uuid>` funktioniert nur gegen ein Backend mit APP_ENV=dev. */
async function devUserId(): Promise<string> {
  let id = await secureStorage.getItem(DEV_KEY);
  if (!id) { id = Crypto.randomUUID(); await secureStorage.setItem(DEV_KEY, id); }
  return id;
}

export type Provider = "apple" | "google" | "email";

export async function getToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return (await secureStorage.getItem(DEV_KEY)) ? `dev:${await devUserId()}` : null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function hasSession(): Promise<boolean> { return (await getToken()) !== null; }

export async function signIn(provider: Provider, email?: string): Promise<{ ok: boolean; message?: "emailSent" }> {
  const sb = supabase();
  if (!sb) { await devUserId(); return { ok: true }; }
  if (provider === "apple") {
    const AppleAuth = await import("expo-apple-authentication");
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    const cred = await AppleAuth.signInAsync({ requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL], nonce: hashed });
    if (!cred.identityToken) return { ok: false };
    const { error } = await sb.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce });
    return { ok: !error };
  }
  if (provider === "google") {
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) return { ok: false };
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return { ok: false };
    const code = new URL(res.url).searchParams.get("code");
    if (!code) return { ok: false };
    const { error: e2 } = await sb.auth.exchangeCodeForSession(code);
    return { ok: !e2 };
  }
  if (!email) return { ok: false };
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: Linking.createURL("auth-callback") } });
  return { ok: !error, message: "emailSent" };
}

export async function signOut(): Promise<void> {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
  else await secureStorage.removeItem(DEV_KEY);
}

/** Nach Konto-Loeschung: lokale Reste entfernen. */
export async function wipeLocalSession(): Promise<void> {
  try { await signOut(); } catch { /* */ }
  await secureStorage.removeItem(DEV_KEY);
}

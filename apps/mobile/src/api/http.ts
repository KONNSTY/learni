import { ApiError, type LearniApi } from "./types";

export type TokenProvider = () => Promise<string | null>;

/** HTTP-Client gegen das FastAPI-Backend. Der Client ruft KI-Provider NIE direkt auf. */
export function createHttpApi(baseUrl: string, getToken: TokenProvider, fetchImpl: typeof fetch = fetch, timeoutMs = 20000): LearniApi {
  const base = baseUrl.replace(/\/$/, "");
  async function call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth) {
        const token = await getToken();
        if (!token) throw new ApiError(401, "not signed in");
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetchImpl(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      const data = text ? JSON.parse(text) : undefined;
      if (!res.ok) throw new ApiError(res.status, typeof data?.detail === "string" ? data.detail : "request failed");
      return data as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, e instanceof Error && e.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  }
  const q = (language: string) => `?language=${encodeURIComponent(language)}`;
  return {
    mode: "http",
    config: () => call("GET", "/v1/config", undefined, false),
    languages: () => call("GET", "/v1/languages", undefined, false),
    sync: (i) => call("POST", "/v1/auth/sync", i),
    patchProfile: (p) => call("PATCH", "/v1/profile", p),
    onboarding: (i) => call("POST", "/v1/onboarding", i),
    state: (l) => call("GET", "/v1/state" + q(l)),
    nextExercise: (language, mode = "curriculum") => call("POST", "/v1/exercises/next", { language, mode }),
    answer: async (id, i) => (await call<{ events: never[] }>("POST", `/v1/exercises/${encodeURIComponent(id)}/answer`, i)).events,
    completeLesson: async (i) => (await call<{ events: never[] }>("POST", "/v1/lessons/complete", i)).events,
    rewardedAd: async (l) => (await call<{ events: never[] }>("POST", "/v1/ads/rewarded" + q(l))).events,
    voiceTurn: (i) => call("POST", "/v1/voice/turn", i),
    explain: (language, item_id) => call("POST", "/v1/explain", { language, item_id }),
    tutorProfile: (l) => call("GET", "/v1/tutor-profile" + q(l)),
    deleteTutorProfile: (l) => call("DELETE", "/v1/tutor-profile" + q(l)),
    exportData: () => call("GET", "/v1/export"),
    deleteAccount: () => call("DELETE", "/v1/account"),
    devSetTier: (tier) => call("POST", "/v1/dev/membership", { tier }),
    track: async (name, props, language) => { await call("POST", "/v1/analytics/events", { name, props: props ?? {}, language }); },
  };
}

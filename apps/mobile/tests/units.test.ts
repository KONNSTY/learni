import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "../src/logic/base64";
import { formatMoney } from "../src/logic/format";
import { canShowInterstitial, isMinor, requestConfig } from "../src/ads/policy";
import { ALL_TRIGGERS, offersRewardedAd, paywallKeys, shouldShowPaywall } from "../src/paywall/triggers";
import { createChunkedStorage } from "../src/auth/secureStorage.chunked";
import { buildQuestions, hasQuestionBank } from "../src/onboarding/questions";
import { gateFor } from "../src/navigation/gate";
import { de } from "../src/i18n/de";
import { isSpeaking, onSpeakingEnd, setSpeaking, SPEAKING_TTL_MS } from "../src/state/speaking";

describe("base64", () => {
  it("matches Buffer for all padding cases", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 100, 1001]) {
      const b = Uint8Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255);
      expect(bytesToBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });
});

describe("paywall triggers", () => {
  it("pro never sees a paywall; speaking blocks it; cooldown applies", () => {
    const now = 1_000_000;
    expect(shouldShowPaywall("hearts_empty", "pro", {}, now)).toBe(false);
    expect(shouldShowPaywall("hearts_empty", "free", {}, now, true)).toBe(false);
    expect(shouldShowPaywall("hearts_empty", "free", {}, now)).toBe(true);
    expect(shouldShowPaywall("hearts_empty", "free", { hearts_empty: now - 60_000 }, now)).toBe(false);
    expect(shouldShowPaywall("hearts_empty", "free", { hearts_empty: now - 11 * 60_000 }, now)).toBe(true);
    expect(shouldShowPaywall("onboarding_plan", "free", { onboarding_plan: 1 }, now * 1000)).toBe(false);
  });
  it("all five triggers exist with texts; rewarded ad only on hearts_empty", () => {
    expect(ALL_TRIGGERS).toHaveLength(5);
    for (const t of ALL_TRIGGERS) { const k = paywallKeys(t); expect(k.title in de && k.body in de, t).toBe(true); }
    expect(ALL_TRIGGERS.filter(offersRewardedAd)).toEqual(["hearts_empty"]);
  });
});

describe("ads policy", () => {
  const base = { tier: "free" as const, ageBracket: "18_plus", speaking: false, inLesson: false, personalizedConsent: true };
  it("never during speech or lesson, never for pro", () => {
    expect(canShowInterstitial(base)).toBe(true);
    expect(canShowInterstitial({ ...base, speaking: true })).toBe(false);
    expect(canShowInterstitial({ ...base, inLesson: true })).toBe(false);
    expect(canShowInterstitial({ ...base, tier: "pro" })).toBe(false);
  });
  it("minors and unknown age get non-personalized ads only", () => {
    expect(isMinor("under_16") && isMinor("16_17") && !isMinor("18_plus")).toBe(true);
    expect(requestConfig({ ageBracket: "under_16", personalizedConsent: true })).toMatchObject({ requestNonPersonalizedAdsOnly: true, tagForUnderAgeOfConsent: true });
    expect(requestConfig({ ageBracket: null, personalizedConsent: true }).requestNonPersonalizedAdsOnly).toBe(true);
    expect(requestConfig({ ageBracket: "18_plus", personalizedConsent: true }).requestNonPersonalizedAdsOnly).toBe(false);
    expect(requestConfig({ ageBracket: "18_plus", personalizedConsent: false }).requestNonPersonalizedAdsOnly).toBe(true);
  });
});

describe("chunked secure storage", () => {
  const fake = () => { const m = new Map<string, string>(); return { m, b: { getItemAsync: async (k: string) => m.get(k) ?? null, setItemAsync: async (k: string, v: string) => { m.set(k, v); }, deleteItemAsync: async (k: string) => { m.delete(k); } } }; };
  it("round-trips values larger than the SecureStore limit and cleans up", async () => {
    const { m, b } = fake();
    const s = createChunkedStorage(b);
    const big = "x".repeat(5000) + "äöü" + "y".repeat(3000);
    await s.setItem("sb-session", big);
    expect([...m.values()].every((v) => v.length <= 1800 || v === "5")).toBe(true);
    expect(await s.getItem("sb-session")).toBe(big);
    await s.setItem("sb-session", "kurz");
    expect(await s.getItem("sb-session")).toBe("kurz");
    expect([...m.keys()].filter((k) => k.includes(".")).length).toBe(2); // .0 und .n
    await s.removeItem("sb-session");
    expect(m.size).toBe(0);
    expect(await s.getItem("missing")).toBeNull();
  });
});

describe("onboarding questions + gating + money", () => {
  it("every launch language has a bank; item ids use the language prefix; answer is among options", () => {
    for (const l of ["es", "en", "fr", "hr", "id", "tr"]) {
      expect(hasQuestionBank(l)).toBe(true);
      for (const ui of ["de", "en"] as const) for (const q of buildQuestions(l, ui, 3)) { expect(q.item_id.startsWith(l + ".")).toBe(true); expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(q.options.length); }
    }
  });
  it("gate order: login -> ai -> language -> age -> consent -> onboarding -> plan -> main", () => {
    const s = { signedIn: false, aiNoticeAck: false, language: null as string | null, ageKnown: false, consentDone: false, plan: null as unknown, onboarded: false };
    expect(gateFor(s)).toBe("login");
    expect(gateFor({ ...s, signedIn: true })).toBe("ai");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true })).toBe("language");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true, language: "es" })).toBe("age");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true, language: "es", ageKnown: true })).toBe("consent");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true, language: "es", ageKnown: true, consentDone: true })).toBe("onboarding");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true, language: "es", ageKnown: true, consentDone: true, plan: {} })).toBe("plan");
    expect(gateFor({ ...s, signedIn: true, aiNoticeAck: true, language: "es", ageKnown: true, consentDone: true, plan: {}, onboarded: true })).toBe("main");
  });
  it("formats prices per locale", () => { expect(formatMoney(11.99, "EUR", "de")).toMatch(/11,99\s?€/); expect(formatMoney(11.99, "EUR", "en")).toContain("11.99"); });
});

describe("speaking flag", () => {
  it("expires so a missing speech-end callback cannot block paywalls forever", () => {
    setSpeaking(true, 1000);
    expect(isSpeaking(1000 + 5000)).toBe(true);
    expect(isSpeaking(1000 + SPEAKING_TTL_MS + 1)).toBe(false);
    setSpeaking(false); expect(isSpeaking(2000)).toBe(false);
  });
  it("notifies listeners when the tutor stops so deferred paywalls can be shown", () => {
    let n = 0; const off = onSpeakingEnd(() => { n++; });
    setSpeaking(true); setSpeaking(false);
    expect(n).toBe(1);
    setSpeaking(false); expect(n).toBe(1); // kein Doppelaufruf
    off();
  });
});

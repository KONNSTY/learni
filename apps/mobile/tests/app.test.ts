import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { de } from "../src/i18n/de";
import { en } from "../src/i18n/en";
import { translate } from "../src/i18n/translate";
import { buildTheme } from "../src/theme/build";
import { tokens } from "../src/theme/tokens.generated";
import { createHttpApi } from "../src/api/http";
import { ApiError } from "../src/api/types";

describe("i18n", () => {
  it("de and en have identical keys and placeholders", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(de) as (keyof typeof de)[]) expect(ph(en[k]), k).toBe(ph(de[k]));
  });
  it("interpolates and falls back", () => {
    expect(translate("de", "streak.title", { n: 12 })).toBe("12 Tage in Folge!");
    expect(translate("en", "main.streak", { n: 3 })).toBe("3 days");
    expect(translate("en", "plan.summary", { weeks: 4 })).toContain("{minutes}");
  });
  it("no placeholder texts in UI strings", () => {
    for (const v of [...Object.values(de), ...Object.values(en)]) expect(v).not.toMatch(/lorem|ipsum|todo|xxx/i);
  });
});

describe("theme & tokens", () => {
  it("generated tokens are in sync with packages/tokens/tokens.json", () => {
    const src = JSON.parse(readFileSync(join(__dirname, "../../../packages/tokens/tokens.json"), "utf8"));
    expect(tokens).toEqual(src);
  });
  it("light/dark share color names; reduce motion zeroes durations", () => {
    expect(Object.keys(tokens.color.dark).sort()).toEqual(Object.keys(tokens.color.light).sort());
    expect(buildTheme("dark", false).colors.bg).toBe("#12151C");
    expect(buildTheme("light", true).duration).toEqual({ instant: 0, fast: 0, base: 0, slow: 0 });
    expect(buildTheme("light", false).duration.base).toBe(280);
  });
  it("text/background contrast >= 4.5:1 in both schemes", () => {
    const lum = (hex: string) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    for (const s of ["light", "dark"] as const) {
      const c = tokens.color[s];
      expect(ratio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.textMuted, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.primaryText, c.primary)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("http api client", () => {
  const res = (status: number, body?: unknown) => ({ status, ok: status < 400, text: async () => (body === undefined ? "" : JSON.stringify(body)) }) as Response;
  it("sends bearer token and maps errors", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return calls.length === 1 ? res(200, { status: "ok" }) : res(403, { detail: "consent_required: voice_processing" }); }) as unknown as typeof fetch;
    const api = createHttpApi("https://api.example.com/", async () => "tok", f);
    await api.state("es");
    expect(calls[0].url).toBe("https://api.example.com/v1/state?language=es");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    await expect(api.voiceTurn({ language: "es", text: "x" })).rejects.toMatchObject({ status: 403, detail: "consent_required: voice_processing" });
  });
  it("public endpoints need no token; missing token -> 401; network -> status 0", async () => {
    const f = (async () => res(200, [])) as unknown as typeof fetch;
    const noTok = createHttpApi("https://x", async () => null, f);
    await expect(noTok.languages()).resolves.toEqual([]);
    await expect(noTok.state("es")).rejects.toBeInstanceOf(ApiError);
    const bad = createHttpApi("https://x", async () => "t", (async () => { throw new TypeError("fail"); }) as unknown as typeof fetch);
    await expect(bad.state("es")).rejects.toMatchObject({ status: 0, detail: "network" });
  });
  it("204 returns undefined", async () => {
    const api = createHttpApi("https://x", async () => "t", (async () => res(204)) as unknown as typeof fetch);
    await expect(api.deleteAccount()).resolves.toBeUndefined();
  });
});

describe("no secrets in client env", () => {
  it("env config only exposes EXPO_PUBLIC_* values", () => {
    const src = readFileSync(join(__dirname, "../src/config/env.ts"), "utf8");
    const vars = [...src.matchAll(/e\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(vars.length).toBeGreaterThan(3);
    for (const v of vars) expect(v.startsWith("EXPO_PUBLIC_"), v).toBe(true);
    expect(vars.some((v) => /SERVICE_ROLE|SECRET|GROQ|AZURE|ELEVEN|LLM|WEBHOOK/.test(v))).toBe(false);
  });
});

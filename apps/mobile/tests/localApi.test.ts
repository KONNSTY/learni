import { describe, expect, it } from "vitest";
import { createLocalApi } from "../src/mock/localApi";
import type { Exercise } from "../src/api/types";
import { assertEvents, assertExercise } from "./helpers";

const day = (n: number) => () => new Date(Date.UTC(2026, 8, 29 + n, 12));

async function play(api: ReturnType<typeof createLocalApi>, n: number, correct = true) {
  const all: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const { exercise } = await api.nextExercise("es");
    assertExercise(exercise);
    const exp = api.issued.get(exercise.id)!.expected;
    const answer = correct ? (exp ?? "x") : "WRONG";
    all.push(...(await api.answer(exercise.id, { language: "es", answer: answer as string, response_ms: 3000 })));
  }
  return all;
}

describe("local mock api (Expo Go without backend)", () => {
  it("full flow: onboarding -> exercises -> lesson -> delete without errors, all outputs contract-valid", async () => {
    const api = createLocalApi({ now: day(0) });
    await api.sync({ ui_language: "de" });
    const plan = await api.onboarding({ language: "es", self_level: "none", adaptive_answers: [], goal: "travel", daily_goal_minutes: 10 });
    expect(plan).toMatchObject({ level: "A1", paywall_trigger: "onboarding_plan" });
    const evs = await play(api, 18);
    assertEvents(evs);
    const done = await api.completeLesson({ language: "es", xp: 50, mistakes: 0, minutes: 5 });
    assertEvents(done);
    expect(done.map((e) => e.type)).toContain("lesson.completed");
    const st = await api.state("es");
    expect(st.learning.streak_days).toBe(1);
    expect(st.learning.xp).toBeGreaterThan(100);
    await api.deleteAccount();
    expect((await api.state("es")).learning.xp).toBe(0);
  });

  it("all eight exercise types are produced (roleplay only for pro)", async () => {
    const api = createLocalApi({ now: day(0) });
    const seen = new Set<string>();
    for (let i = 0; i < 27; i++) { const { exercise } = await api.nextExercise("es"); seen.add(exercise.type); api.issued.delete(exercise.id); }
    expect([...seen].sort()).toEqual(["fill_blank", "flashcard", "listen_pick", "matching", "multiple_choice", "speak_repeat", "word_order"]);
    await api.devSetTier("pro");
    const pro = new Set<string>();
    for (let i = 0; i < 27; i++) pro.add((await api.nextExercise("es")).exercise.type);
    expect(pro.has("roleplay")).toBe(true);
  });

  it("hearts: wrong decidable answers cost hearts until empty, then only non-decidable formats, speaking never costs", async () => {
    const api = createLocalApi({ now: day(0) });
    let lost = 0; let paywall = false;
    for (let i = 0; i < 40; i++) {
      const { exercise } = await api.nextExercise("es");
      const evs = await api.answer(exercise.id, { language: "es", answer: "WRONG" });
      assertEvents(evs);
      const ae = evs[0].payload as { hearts_lost: number };
      if (!exercise.decidable) expect(ae.hearts_lost).toBe(0);
      lost += ae.hearts_lost; paywall ||= evs.some((e) => e.type === "paywall.requested");
    }
    expect(lost).toBe(5); expect(paywall).toBe(true);
    const nxt = await api.nextExercise("es");
    expect(nxt.exercise.decidable).toBe(false);
    expect(nxt.events.some((e) => e.type === "hearts.empty")).toBe(true);
    const ad = await api.rewardedAd("es");
    assertEvents(ad);
    expect((await api.state("es")).learning.hearts).toBe(1);
  });

  it("pro has unlimited hearts and no rewarded ads", async () => {
    const api = createLocalApi({ now: day(0) });
    await api.devSetTier("pro");
    await play(api, 12, false);
    expect((await api.state("es")).learning.unlimited_hearts).toBe(true);
    await expect(api.rewardedAd("es")).rejects.toMatchObject({ status: 409 });
  });

  it("streak increments on consecutive days and resets after a gap", async () => {
    let d = 0;
    const api = createLocalApi({ now: () => day(d)() });
    const finish = () => api.completeLesson({ language: "es", xp: 1, mistakes: 0, minutes: 1 });
    await finish(); d = 1; await finish(); d = 2; await finish();
    expect((await api.state("es")).learning.streak_days).toBe(3);
    d = 9; await finish();
    expect((await api.state("es")).learning.streak_days).toBe(1);
  });

  it("voice turn needs consent for audio, roleplay is pro-only, mock replies are flagged and viseme ranges valid", async () => {
    const api = createLocalApi({ now: day(0) });
    await expect(api.voiceTurn({ language: "es", audio_b64: "AAAA" })).rejects.toMatchObject({ status: 403 });
    const r = await api.voiceTurn({ language: "es", text: "Hola" });
    assertEvents(r.events);
    const speak = r.events[0].payload as { mock: boolean; visemes: { viseme: number }[] };
    expect(speak.mock).toBe(true); expect(speak.visemes.every((v) => v.viseme >= 0 && v.viseme <= 21)).toBe(true);
    const rp = await api.voiceTurn({ language: "es", text: "Hola", scenario_id: "cafe" });
    expect(rp.events[0].type).toBe("paywall.requested");
    const second = await api.voiceTurn({ language: "es", text: "Me llamo Mia" });
    assertExercise(second.tutor_turn as Exercise);
  });

  it("under-16 profiles can never enable personalized ads", async () => {
    const api = createLocalApi();
    const p = await api.patchProfile({ age_bracket: "under_16", consents: { personalized_ads: true } });
    expect(p.consents.personalized_ads).toBe(false);
  });

  it("answers are single-use and unknown ids 404", async () => {
    const api = createLocalApi();
    const { exercise } = await api.nextExercise("es");
    await api.answer(exercise.id, { language: "es", answer: "x" });
    await expect(api.answer(exercise.id, { language: "es", answer: "x" })).rejects.toMatchObject({ status: 404 });
  });
});

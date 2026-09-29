import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventBus } from "../src/events/bus";
import { EVENT_TYPES, isEvent } from "../src/events/types";
import { applyPrefs, extraFor, feedbackFor, HANDLED_EVENTS } from "../src/feedback/feedbackMap";
import { loadSchema } from "./helpers";

const mk = (type: string, payload: object) => ({ event_version: "1.0.0", type, ts: "t", payload });

describe("event contract parity", () => {
  it("frontend event list equals the schema's oneOf types", () => {
    const schema = loadSchema("events.schema.json");
    const types = schema.oneOf.map((o: { properties: { type: { const: string } } }) => o.properties.type.const).sort();
    expect([...EVENT_TYPES].sort()).toEqual(types);
  });
  it("handled feedback events are a subset of known events", () => { expect(HANDLED_EVENTS.every((t) => EVENT_TYPES.includes(t))).toBe(true); });
});

describe("EventBus", () => {
  it("routes typed events, isolates handler errors, drops unknown/invalid events", () => {
    const bus = new EventBus();
    const a = vi.fn(); const any = vi.fn();
    bus.on("reward.granted", a);
    bus.on("reward.granted", () => { throw new Error("boom"); });
    bus.onAny(any);
    expect(bus.emit(mk("reward.granted", { kind: "xp", amount: 10 }))).toBe(true);
    expect(bus.emit(mk("future.event", {}))).toBe(false);
    expect(bus.emit({ type: "reward.granted" })).toBe(false);
    expect(bus.emit(null)).toBe(false);
    expect(a).toHaveBeenCalledTimes(1); expect(any).toHaveBeenCalledTimes(1);
    expect(bus.emitAll([mk("hearts.changed", { hearts: 1, max_hearts: 5 }), 5, undefined])).toBe(1);
    expect(bus.emitAll(undefined)).toBe(0);
  });
  it("unsubscribe works", () => {
    const bus = new EventBus(); const h = vi.fn(); const off = bus.on("level.up", h); off();
    bus.emit(mk("level.up", { language: "es", level: "A2" })); expect(h).not.toHaveBeenCalled();
  });
  it("isEvent validates shape", () => { expect(isEvent(mk("level.up", {}))).toBe(true); expect(isEvent({ ...mk("level.up", {}), event_version: "2" })).toBe(false); });
});

describe("feedback map (Haptik/Sound/Motion)", () => {
  const ev = (correct: boolean, decidable: boolean, lost = 0) => mk("answer.evaluated", { exercise_id: "1", correct, decidable, hearts_lost: lost, feedback_key: "k" }) as never;
  it("correct -> success feedback; wrong decidable -> error; speaking mistake -> soft only, no wrong sound", () => {
    expect(feedbackFor(ev(true, true))).toMatchObject({ sfx: "correct", haptic: "success" });
    expect(feedbackFor(ev(false, true, 1))).toMatchObject({ sfx: "wrong", haptic: "error", animation: "shake" });
    expect(feedbackFor(ev(false, false))).toEqual({ haptic: "soft", animation: "none" });
    expect(extraFor(ev(false, true, 1))).toMatchObject({ sfx: "heart_break" });
    expect(extraFor(ev(false, false, 0))).toBeNull();
  });
  it("celebrations are strongest", () => {
    expect(feedbackFor(mk("lesson.completed", { xp_gained: 1, mistakes: 0, minutes: 1 }) as never)).toMatchObject({ haptic: "heavy", animation: "confetti_big" });
    expect(feedbackFor(mk("level.up", { language: "es", level: "A2" }) as never)).toMatchObject({ sfx: "level_up", haptic: "heavy" });
    expect(feedbackFor(mk("avatar.speak", {}) as never)).toBeNull();
  });
  it("separate toggles and reduce motion", () => {
    const f = { sfx: "correct", haptic: "success", animation: "confetti_small" } as const;
    expect(applyPrefs(f, { sfx: false, haptics: true, reduceMotion: false, systemMuted: false })).toEqual({ sfx: undefined, haptic: "success", animation: "confetti_small" });
    expect(applyPrefs(f, { sfx: true, haptics: false, reduceMotion: true, systemMuted: false })).toEqual({ sfx: "correct", haptic: "none", animation: "none" });
    expect(applyPrefs(f, { sfx: true, haptics: true, reduceMotion: false, systemMuted: true }).sfx).toBeUndefined();
  });
  it("no ui instructions leak into the contract", () => {
    const schema = readFileSync(join(__dirname, "../../../packages/contracts/schemas/events.schema.json"), "utf8");
    expect(schema).not.toMatch(/haptic|sound|animation|color/i);
  });
});

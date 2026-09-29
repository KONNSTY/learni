import { describe, expect, it } from "vitest";
import { addHeart, isDecidable, loseHeart } from "../src/logic/hearts";
import { defaultVad, vadInit, vadStep } from "../src/logic/vad";
import { clampViseme, MOUTH_OPEN, textToVisemes, visemeAt } from "../src/avatar/visemes";
import { placeholderManifest, validateManifest } from "../src/avatar/manifest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSchema } from "./helpers";
import Ajv2020 from "ajv/dist/2020";

describe("hearts", () => {
  it("decidable formats cost a heart, speaking never", () => {
    const h = { count: 5, max: 5 };
    expect(loseHeart(h, "multiple_choice")).toEqual({ state: { count: 4, max: 5 }, lost: 1 });
    for (const t of ["speak_repeat", "roleplay", "flashcard"]) expect(loseHeart(h, t).lost).toBe(0);
    expect(isDecidable("fill_blank")).toBe(true);
  });
  it("pro is unlimited, floor at zero, add caps at max", () => {
    expect(loseHeart({ count: 0, max: null }, "matching").lost).toBe(0);
    expect(loseHeart({ count: 0, max: 5 }, "matching").lost).toBe(0);
    expect(addHeart({ count: 5, max: 5 }).count).toBe(5);
    expect(addHeart({ count: 2, max: 5 }).count).toBe(3);
  });
});

describe("vad", () => {
  const run = (levels: number[]) => levels.reduce((s, l) => vadStep(s, l), vadInit());
  it("ignores silence and short blips, stops after speech followed by silence", () => {
    expect(run(Array(20).fill(0.01)).speaking).toBe(false);
    expect(run([0.5, 0.01, 0.01]).speaking).toBe(false);
    const done = run([...Array(5).fill(0.4), ...Array(defaultVad.silenceFramesToStop).fill(0.01)]);
    expect(done.speaking && done.done).toBe(true);
  });
  it("hard-stops at max frames", () => { expect(run(Array(defaultVad.maxFrames).fill(0.01)).done).toBe(true); });
});

describe("visemes", () => {
  it("range, ordering and terminal silence", () => {
    const v = textToVisemes("Quiero un café, por favor", 1500);
    expect(v[v.length - 1]).toEqual({ t_ms: 1500, viseme: 0 });
    expect(v.every((x) => x.viseme >= 0 && x.viseme <= 21)).toBe(true);
    expect(v.map((x) => x.t_ms)).toEqual([...v.map((x) => x.t_ms)].sort((a, b) => a - b));
    expect(textToVisemes("", 100)).toEqual([{ t_ms: 0, viseme: 0 }]);
  });
  it("visemeAt finds the active viseme and clamps", () => {
    const tl = [{ t_ms: 0, viseme: 0 }, { t_ms: 100, viseme: 4 }, { t_ms: 200, viseme: 21 }];
    expect([visemeAt(tl, 0), visemeAt(tl, 99), visemeAt(tl, 100), visemeAt(tl, 999)]).toEqual([0, 0, 4, 21]);
    expect(visemeAt([], 10)).toBe(0);
    expect(clampViseme(99)).toBe(21);
    expect(MOUTH_OPEN).toHaveLength(22);
  });
  it("matches the python heuristic for a known string", () => {
    expect(textToVisemes("ola", 300).map((x) => x.viseme)).toEqual([8, 14, 2, 0]);
  });
});

describe("avatar manifest", () => {
  it("placeholder and example file satisfy the contract schema and runtime validator", () => {
    const ajv = new Ajv2020({ strict: false });
    const validate = ajv.compile(loadSchema("avatar-manifest.schema.json"));
    const example = JSON.parse(readFileSync(join(__dirname, "../../../packages/contracts/examples/avatar-manifest.placeholder.json"), "utf8"));
    expect(validate(example)).toBe(true);
    expect(validate(placeholderManifest)).toBe(true);
    expect(validateManifest(example)).toBe(true);
    expect(validateManifest({ ...example, inputs: { ...example.inputs, viseme: { name: "v", min: 0, max: 30 } } })).toBe(false);
    expect(validateManifest(null)).toBe(false);
  });
});

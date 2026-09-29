import { textToVisemes } from "../avatar/visemes";
import type { LearniEvent } from "../events/types";
import { addHeart, isDecidable, loseHeart } from "../logic/hearts";
import { ApiError, type AnswerInput, type Exercise, type Language, type LearniApi, type Level, type OnboardingInput, type Tier, type UserState, type VoiceTurnInput } from "../api/types";
import { BLANKS, DIALOG, ITEMS, SENTENCES, type MockItem } from "./mockContent";

export interface KV { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void> }
const memoryKV = (): KV => { const m = new Map<string, string>(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, v); }, remove: async (k) => { m.delete(k); } }; };

const LANGUAGES: Language[] = [
  { code: "en", name: "English", native_name: "English", tier: "A", badge: "EN", region_variants: ["en-GB", "en-US"] },
  { code: "es", name: "Spanish", native_name: "Español", tier: "A", badge: "ES", region_variants: ["es-ES", "es-MX"] },
  { code: "fr", name: "French", native_name: "Français", tier: "A", badge: "FR" },
  { code: "hr", name: "Croatian", native_name: "Hrvatski", tier: "B", badge: "HR" },
  { code: "id", name: "Indonesian", native_name: "Bahasa Indonesia", tier: "B", badge: "ID" },
  { code: "tr", name: "Turkish", native_name: "Türkçe", tier: "B", badge: "TR" },
];
const PLAN = ["flashcard", "flashcard", "multiple_choice", "listen_pick", "fill_blank", "word_order", "matching", "speak_repeat", "roleplay"] as const;
const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

interface Persisted { user: UserState; seq: number; lessons: number; lastActive: string | null; dialogIdx: number; tutor: { goals: string[]; typical_mistakes: string[]; pace: string } }
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]/g, "").trim().toLowerCase();

export function createLocalApi(opts: { kv?: KV; now?: () => Date } = {}): LearniApi & { issued: Map<string, { type: string; expected: string | string[] | null }> } {
  const kv = opts.kv ?? memoryKV();
  const now = opts.now ?? (() => new Date());
  const issued = new Map<string, { type: string; expected: string | string[] | null; item?: string }>();
  let s: Persisted | null = null;
  const ts = () => now().toISOString();
  const ev = <T extends LearniEvent["type"]>(type: T, payload: Extract<LearniEvent, { type: T }>["payload"]): LearniEvent => ({ event_version: "1.0.0", type, ts: ts(), payload } as LearniEvent);

  const fresh = (): Persisted => ({
    user: {
      profile: { user_id: "local-user", display_name: null, native_language: "de", ui_language: "de", age_bracket: null, settings: { avatar_voice: true, sfx: true, haptics: true, show_translation: true, auto_vad: false }, consents: { voice_processing: false, personalized_ads: false, analytics: false } },
      membership: { tier: "free", status: "active", trial: false, source: "mock" },
      learning: { language: "es", level: "A1", goal: "fun", daily_goal_minutes: 10, daily_xp: 0, daily_xp_target: 100, xp: 0, streak_days: 0, streak_freezes: 0, hearts: 5, max_hearts: 5, unlimited_hearts: false, trophies: [], skills: { listening: 0, speaking: 0, vocabulary: 0, grammar: 0 } },
      budget: { ai_seconds_used: 0, ai_seconds_limit: 600, cost_cents_used: 0, cost_cents_limit: 25, limited: false },
    },
    seq: 0, lessons: 0, lastActive: null, dialogIdx: 0, tutor: { goals: [], typical_mistakes: [], pace: "normal" },
  });
  async function load(): Promise<Persisted> {
    if (s) return s;
    try { const raw = await kv.get("learni.mock.state"); s = raw ? (JSON.parse(raw) as Persisted) : fresh(); } catch { s = fresh(); }
    return s;
  }
  const save = async () => { if (s) await kv.set("learni.mock.state", JSON.stringify(s)); };
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const tr = (i: MockItem, ui: string) => (ui === "de" ? i.de : i.en);

  function build(st: Persisted): { ex: Exercise; expected: string | string[] | null } {
    const u = st.user, ui = u.profile.ui_language;
    const heartsOut = !u.learning.unlimited_hearts && u.learning.hearts <= 0;
    let type: string = PLAN[st.seq % PLAN.length];
    if (type === "roleplay" && u.membership.tier === "free") type = "speak_repeat";
    if (heartsOut && isDecidable(type)) type = "speak_repeat";
    const item = ITEMS[st.seq % ITEMS.length];
    const others = ITEMS.filter((i) => i.id !== item.id);
    const rot = (arr: string[], k: number) => arr.map((_, i) => arr[(i + k) % arr.length]);
    const id = `ex_mock_${st.seq}_${Math.abs(item.id.length * 31 + st.seq)}`;
    const base = (t: string, say: string, skill: string) => ({
      schema_version: "1.0.0" as const, id, type: t, language: u.learning.language, item_id: item.id, skill, level: u.learning.level,
      decidable: isDecidable(t), prompt: { say, translation: null as string | null, audio_url: null as string | null, hint: null as string | null }, content: {} as Exercise["content"], source: "mock" as const, pack_status: "draft" as const,
    });
    let ex: Exercise; let expected: string | string[] | null = null;
    switch (type) {
      case "flashcard": ex = base("flashcard", item.lemma, "vocabulary") as Exercise; ex.prompt.translation = tr(item, ui); ex.content = { target_text: item.lemma }; break;
      case "multiple_choice": case "listen_pick": {
        ex = base(type, item.lemma, type === "listen_pick" ? "listening" : "vocabulary") as Exercise;
        const opts = rot([tr(item, ui), ...others.slice(st.seq % 5, (st.seq % 5) + 2).map((o) => tr(o, ui))], st.seq % 3);
        ex.content = { options: opts }; expected = tr(item, ui); break;
      }
      case "fill_blank": { const b = BLANKS[0]; ex = base("fill_blank", b.sentence.replace("___", "…"), "grammar") as Exercise; ex.prompt.translation = ui === "de" ? b.de : b.en; ex.content = { sentence_with_blank: b.sentence, options: rot(b.options, st.seq % 3) }; expected = b.answer; break; }
      case "word_order": { const sn = SENTENCES[st.seq % SENTENCES.length]; ex = base("word_order", ui === "de" ? sn.de : sn.en, "grammar") as Exercise; ex.content = { tokens: rot(sn.tokens, 1) }; expected = sn.tokens; break; }
      case "matching": { const pairs = ITEMS.slice(0, 3).map((i) => ({ left: i.lemma, right: tr(i, ui) })); ex = base("matching", "", "vocabulary") as Exercise; ex.content = { pairs: pairs.map((p, i) => ({ left: p.left, right: pairs[(i + 1) % pairs.length].right })) }; expected = pairs.map((p) => `${p.left}|${p.right}`); break; }
      case "speak_repeat": ex = base("speak_repeat", item.lemma, "speaking") as Exercise; ex.content = { target_text: item.lemma }; expected = item.lemma; break;
      default: ex = base("roleplay", "¿Qué desea tomar?", "speaking") as Exercise; ex.content = { scenario: "cafe" }; expected = "café";
    }
    if (u.learning.level === "A1" && st.seq > 0 && ex.decidable && st.user.learning.skills.vocabulary < 0.3) ex.prompt.hint = `${item.lemma[0]}…`;
    return { ex, expected };
  }

  const api = {
    mode: "mock" as const, issued,
    async config() { return { pricing: { currency: "EUR", monthly: 11.99, yearly: 69.99, trial_days: 7 }, free: { max_hearts: 5, ai_seconds_per_day: 600 }, pro: { ai_seconds_per_day: 2700 }, feature_flags: { show_test_mode_badge: true } }; },
    async languages() { return clone(LANGUAGES); },
    async sync(input) { const st = await load(); Object.assign(st.user.profile, { native_language: input.native_language ?? st.user.profile.native_language, ui_language: input.ui_language ?? st.user.profile.ui_language, display_name: input.display_name ?? st.user.profile.display_name }); await save(); return clone(st.user); },
    async patchProfile(p) {
      const st = await load(); const pr = st.user.profile;
      if (p.display_name !== undefined) pr.display_name = p.display_name;
      if (p.age_bracket !== undefined) pr.age_bracket = p.age_bracket;
      if (p.ui_language) pr.ui_language = p.ui_language;
      if (p.settings) pr.settings = { ...pr.settings, ...p.settings } as typeof pr.settings;
      if (p.consents) pr.consents = { ...pr.consents, ...p.consents } as typeof pr.consents;
      if (pr.age_bracket === "under_16") pr.consents.personalized_ads = false;
      await save(); return clone(pr);
    },
    async onboarding(i: OnboardingInput) {
      const st = await load();
      let idx = { none: 0, few_words: 0, simple_conversations: 1, everyday: 2 }[i.self_level];
      if (i.self_level !== "none" && i.adaptive_answers.length >= 2) {
        const acc = i.adaptive_answers.filter((a) => a.correct).length / i.adaptive_answers.length;
        if (acc >= 0.99 && idx < 2) idx += 1; else if (acc <= 0.34 && idx > 0) idx -= 1;
      }
      Object.assign(st.user.learning, { language: i.language, level: LEVELS[idx], goal: i.goal, daily_goal_minutes: i.daily_goal_minutes, daily_xp_target: i.daily_goal_minutes * 10 });
      await save();
      return { language: i.language, level: LEVELS[idx], weeks_to_next_level: Math.max(2, Math.round(30 / Math.max(1, (i.daily_goal_minutes * 4) / 10) / 7 * 4)), daily_goal_minutes: i.daily_goal_minutes, topics: ["basics", "food_drink"], paywall_trigger: "onboarding_plan" as const };
    },
    async state(language) { const st = await load(); st.user.learning.language = language; return clone(st.user); },
    async nextExercise(language) {
      const st = await load(); st.user.learning.language = language;
      const { ex, expected } = build(st);
      issued.set(ex.id, { type: ex.type, expected }); st.seq += 1; await save();
      const events: LearniEvent[] = [];
      const l = st.user.learning;
      if (!l.unlimited_hearts && l.hearts <= 0) events.push(ev("hearts.empty", { paywall_trigger: "hearts_empty" }));
      if (ex.type === "roleplay" && st.user.membership.tier === "free") events.push(ev("paywall.requested", { trigger: "pro_feature" }));
      return { exercise: ex, events, test_mode: true };
    },
    async answer(id: string, input: AnswerInput) {
      const st = await load(); const rec = issued.get(id);
      if (!rec) throw new ApiError(404, "exercise not found");
      issued.delete(id);
      const l = st.user.learning; const events: LearniEvent[] = [];
      let correct: boolean;
      if ((rec.type === "speak_repeat" || rec.type === "roleplay") && input.pronunciation_score !== undefined) correct = input.pronunciation_score >= 60;
      else if (rec.type === "flashcard") correct = true;
      else if (Array.isArray(rec.expected)) { const g = Array.isArray(input.answer) ? input.answer : String(input.answer).split(" "); correct = rec.type === "matching" ? [...rec.expected].map(norm).sort().join() === g.map(norm).sort().join() : rec.expected.map(norm).join() === g.map(norm).join(); }
      else correct = rec.expected === null || norm(String(rec.expected)) === norm(String(input.answer));
      const { state, lost } = loseHeart({ count: l.hearts, max: l.max_hearts }, correct ? "none" : rec.type);
      l.hearts = state.count;
      events.push(ev("answer.evaluated", { exercise_id: id, correct, decidable: isDecidable(rec.type), hearts_lost: lost, feedback_key: correct ? "feedback.correct" : isDecidable(rec.type) ? "feedback.wrong" : "feedback.retry_speaking", correct_answer: correct ? null : rec.expected, pronunciation_score: input.pronunciation_score ?? null }));
      if (lost) { events.push(ev("hearts.changed", { hearts: l.hearts, max_hearts: l.max_hearts, unlimited: l.unlimited_hearts })); if (l.hearts === 0) events.push(ev("hearts.empty", { paywall_trigger: "hearts_empty" }), ev("paywall.requested", { trigger: "hearts_empty" })); }
      if (correct) {
        const before = l.daily_xp >= l.daily_xp_target; l.xp += 10; l.daily_xp += 10;
        events.push(ev("reward.granted", { kind: "xp", amount: 10, reason: "practice" }));
        if (!before && l.daily_xp >= l.daily_xp_target) events.push(ev("daily_goal.reached", { xp: l.daily_xp }));
        const sk = rec.type === "speak_repeat" ? "speaking" : rec.type === "listen_pick" ? "listening" : rec.type === "word_order" || rec.type === "fill_blank" ? "grammar" : "vocabulary";
        l.skills[sk] = Math.min(1, +(l.skills[sk] + 0.15 * (1 - l.skills[sk])).toFixed(4));
        const next = Math.floor(l.xp / 200);
        if (next > LEVELS.indexOf(l.level) && next < LEVELS.length) { l.level = LEVELS[next]; events.push(ev("level.up", { language: l.language, level: l.level })); }
      } else { st.tutor.typical_mistakes = [String(rec.expected ?? ""), ...st.tutor.typical_mistakes].filter(Boolean).slice(0, 10); }
      if (input.response_ms !== undefined) st.tutor.pace = input.response_ms > 9000 ? "slow" : input.response_ms < 2500 ? "fast" : "normal";
      await save(); return events;
    },
    async completeLesson(i) {
      const st = await load(); const l = st.user.learning; const events: LearniEvent[] = [];
      const today = now().toISOString().slice(0, 10);
      if (st.lastActive !== today) {
        const gap = st.lastActive ? Math.round((Date.parse(today) - Date.parse(st.lastActive)) / 86400000) : 0;
        l.streak_days = !st.lastActive ? 1 : gap === 1 ? l.streak_days + 1 : gap - 1 <= l.streak_freezes ? l.streak_days + 1 : 1;
        st.lastActive = today;
      }
      l.xp += 15; l.daily_xp += 15; st.lessons += 1;
      events.push(ev("reward.granted", { kind: "xp", amount: 15, reason: "practice" }), ev("streak.updated", { days: l.streak_days, freeze_used: false, at_risk: false }));
      if (st.lessons === 1 && !l.trophies.includes("first_lesson")) { l.trophies.push("first_lesson"); events.push(ev("reward.granted", { kind: "trophy", amount: 1, trophy_id: "first_lesson" })); }
      events.push(ev("lesson.completed", { xp_gained: 15, mistakes: i.mistakes, minutes: i.minutes }));
      await save(); return events;
    },
    async rewardedAd() {
      const st = await load(); const l = st.user.learning;
      if (st.user.membership.tier === "pro") throw new ApiError(409, "not applicable for pro");
      l.hearts = addHeart({ count: l.hearts, max: l.max_hearts }).count; await save();
      return [ev("reward.granted", { kind: "heart", amount: 1, reason: "rewarded_ad" }), ev("hearts.changed", { hearts: l.hearts, max_hearts: l.max_hearts, unlimited: false })];
    },
    async voiceTurn(input: VoiceTurnInput) {
      const st = await load();
      if (input.audio_b64 && !st.user.profile.consents.voice_processing) throw new ApiError(403, "consent_required: voice_processing");
      if (input.scenario_id && st.user.membership.tier === "free") return { transcript: "", events: [ev("paywall.requested", { trigger: "pro_feature" })], latency_ms: {}, test_mode: true };
      if (input.exercise_id && issued.get(input.exercise_id)?.type === "speak_repeat") {
        const ref = String(issued.get(input.exercise_id)?.expected ?? "");
        return { transcript: ref, events: [], latency_ms: { stt: 5, total: 5 }, test_mode: true, pronunciation: { overall: 82, words: ref.split(" ").map((w, i) => ({ word: w, score: 92 - ((i * 13) % 25) })) } };
      }
      const turn = DIALOG[Math.min(st.dialogIdx, DIALOG.length - 1)]; st.dialogIdx = (st.dialogIdx + 1) % DIALOG.length; await save();
      const dur = Math.max(400, 65 * turn.say.length / (input.slow ? 0.8 : 1));
      const events = [ev("avatar.speak", { text: turn.say, audio_url: null, visemes: textToVisemes(turn.say, dur), emotion: turn.type === "none" ? "happy" : "encouraging", mock: true })];
      const out: import("../api/types").VoiceTurnResult = { transcript: input.text ?? "hola", events, latency_ms: { stt: 5, llm: 5, tts: 5, total: 15 }, test_mode: true };
      if (turn.type !== "none") {
        const id = `ex_mock_llm_${st.dialogIdx}`;
        const ex = { schema_version: "1.0.0", id, type: turn.type, language: input.language, item_id: "llm.turn", skill: turn.type === "speak_repeat" ? "speaking" : "vocabulary", decidable: isDecidable(turn.type), prompt: { say: turn.say, translation: null, audio_url: null, hint: null }, content: turn.type === "multiple_choice" ? { options: turn.options } : { target_text: turn.expected }, source: "mock", pack_status: "draft" } as Exercise;
        issued.set(id, { type: turn.type, expected: turn.expected ?? null }); out.tutor_turn = ex;
      }
      return out;
    },
    async explain(_language: string, itemId: string) {
      const st = await load(); const it = ITEMS.find((i) => i.id === itemId);
      if (!it) throw new ApiError(404, "unknown item");
      const ui = st.user.profile.ui_language;
      return { text: ui === "de" ? `„${it.lemma}“ bedeutet „${it.de}“.` : `“${it.lemma}” means “${it.en}”.`, cached: false, test_mode: true };
    },
    async tutorProfile(language) { const st = await load(); return { language, goals: [st.user.learning.goal], interests: [], typical_mistakes: st.tutor.typical_mistakes, pace: st.tutor.pace }; },
    async deleteTutorProfile() { const st = await load(); st.tutor = { goals: [], typical_mistakes: [], pace: "normal" }; await save(); },
    async exportData() { const st = await load(); return { profile: st.user.profile, membership: st.user.membership, learning: st.user.learning, tutor_profile: st.tutor }; },
    async deleteAccount() { s = fresh(); await kv.remove("learni.mock.state"); },
    async devSetTier(tier: Tier) { const st = await load(); st.user.membership = { ...st.user.membership, tier, status: "active", source: "dev-sandbox" }; st.user.learning.unlimited_hearts = tier === "pro"; st.user.learning.max_hearts = tier === "pro" ? null : 5; if (tier === "free") st.user.learning.hearts = Math.min(st.user.learning.hearts, 5); await save(); return clone(st.user); },
    async track() { /* lokal: nichts senden */ },
  } satisfies LearniApi & { issued: Map<string, { type: string; expected: string | string[] | null; item?: string }> };
  return api;
}

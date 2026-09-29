import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { Exercise } from "../api/types";
import { useAvatarController } from "../avatar/controller";
import { AvatarView } from "../avatar/AvatarView";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Confetti } from "../components/Confetti";
import { LanguageBadge } from "../components/LanguageBadge";
import { MicButton } from "../components/MicButton";
import { StatBar } from "../components/StatBar";
import { Text } from "../components/Text";
import { bus } from "../events/bus";
import type { LearniEvent } from "../events/types";
import { registry } from "../exercises/registry";
import type { ExerciseResult, MicControls } from "../exercises/types";
import { useFeedback } from "../feedback/FeedbackProvider";
import { useI18n } from "../i18n";
import type { Celebration, RootStackParamList } from "../navigation/types";
import { dismissPaywall, finishLesson, nextExercise, patchProfile, refreshState, setSpeaking, startLesson, submitAnswer, track, watchRewardedAd } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme } from "../theme";
import { playUrl, stopPlayback } from "../voice/playUrl";
import { speakLocal, stopLocalSpeech } from "../voice/speak";
import { useRecorder, type Clip } from "../voice/useRecorder";
import { HeartsEmptySheet } from "./HeartsEmptySheet";

export const LESSON_LENGTH = 8;
type Props = NativeStackScreenProps<RootStackParamList, "Main">;

export function MainScreen({ navigation }: Props) {
  const th = useTheme();
  const { t } = useI18n();
  const fb = useFeedback();
  const user = useApp((s) => s.user);
  const api = useApp((s) => s.api)!;
  const language = useApp((s) => s.language)!;
  const languages = useApp((s) => s.languages);
  const testMode = useApp((s) => s.testMode);
  const offline = useApp((s) => s.offline);
  const budgetLimited = useApp((s) => s.budgetLimited);
  const paywall = useApp((s) => s.paywall);
  const answered = useApp((s) => s.lesson.answered);
  const lang = languages.find((l) => l.code === language);
  const settings = user?.profile.settings;
  const avatar = useAvatarController();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const [subtitle, setSubtitle] = useState<{ text: string; translation?: string | null }>({ text: "" });
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [showHearts, setShowHearts] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const shownAt = useRef(Date.now());
  const lastSpoken = useRef<{ text: string; url: string | null }>({ text: "", url: null });
  const pronRef = useRef<{ score: number; words: { word: string; score: number | null }[] } | null>(null);
  const exerciseRef = useRef<Exercise | null>(null);
  exerciseRef.current = exercise;
  const voiceOn = useRef(true);
  voiceOn.current = settings?.avatar_voice ?? true;

  const say = useCallback((text: string, url: string | null, slow = false) => {
    stopPlayback(); stopLocalSpeech();
    if (!voiceOn.current) return;
    setSpeaking(true);
    const done = () => setSpeaking(false);
    if (url) playUrl(url, done); else speakLocal(text, language, slow, done);
  }, [language]);

  // Avatar-Reaktionen + Sprechen aus semantischen Events
  useEffect(() => {
    const off1 = bus.on("avatar.speak", (e) => {
      const p = e.payload;
      if (!p.text) return;
      setSubtitle({ text: p.text, translation: null });
      lastSpoken.current = { text: p.text, url: p.audio_url };
      avatar.speak(p.visemes, p.emotion);
      say(p.text, p.audio_url);
    });
    const off2 = bus.on("answer.evaluated", (e) => avatar.setEmotion(e.payload.correct ? "happy" : "encouraging"));
    const off3 = bus.on("level.up", () => avatar.setEmotion("celebrate"));
    return () => { off1(); off2(); off3(); };
  }, [avatar, say]);

  const load = useCallback(async () => {
    setLoading(true); setResult(null); setExercise(null); pronRef.current = null; // alte Uebung nie kurz "zurueckgesetzt" zeigen (Flackern bei Netzwerk-Latenz)
    try {
      const ex = await nextExercise();
      setExercise(ex); shownAt.current = Date.now();
      setSubtitle({ text: ex.prompt.say, translation: ex.prompt.translation });
      lastSpoken.current = { text: ex.content.target_text ?? ex.prompt.say, url: ex.prompt.audio_url ?? null };
      avatar.setEmotion("neutral");
    } catch { /* offline: Banner zeigt Status, Retry per Button */ } finally { setLoading(false); }
  }, [avatar]);

  useEffect(() => { startLesson(); void load(); return () => { stopPlayback(); stopLocalSpeech(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Paywall-Anfragen: hearts_empty als Sheet, alle anderen als eigener Screen
  useEffect(() => {
    if (!paywall) return;
    if (paywall === "hearts_empty") setShowHearts(true); else { navigation.navigate("Paywall", { trigger: paywall }); dismissPaywall(); }
  }, [paywall, navigation]);

  const submit = useCallback(async (answer: string | string[], meta?: { pronunciation_score?: number }) => {
    const ex = exerciseRef.current; if (!ex) return;
    const events = await submitAnswer(ex.id, { answer, response_ms: Date.now() - shownAt.current, pronunciation_score: meta?.pronunciation_score });
    const ae = events.find((e): e is Extract<LearniEvent, { type: "answer.evaluated" }> => e.type === "answer.evaluated");
    if (ae) setResult({ correct: ae.payload.correct, correctAnswer: ae.payload.correct_answer });
    if (ex.type === "speak_repeat" && pronRef.current) navigation.navigate("PronReport", pronRef.current);
  }, [navigation]);

  // Mikrofon: Push-to-talk (oder Auto-VAD laut Einstellung)
  const sendClip = useCallback(async (clip: Clip | null) => {
    if (!clip) return;
    const ex = exerciseRef.current;
    setThinking(true);
    try {
      const r = await api.voiceTurn({ language, audio_b64: clip.base64, audio_seconds: clip.seconds, audio_mime: clip.mime, exercise_id: ex?.type === "speak_repeat" ? ex.id : undefined });
      bus.emitAll(r.events);
      track("voice_turn", { total_ms: Math.round(r.latency_ms?.total ?? 0) });
      if (ex?.type === "speak_repeat") {
        const score = r.pronunciation?.overall ?? 0;
        pronRef.current = r.pronunciation ? { score, words: r.pronunciation.words } : null;
        await submit(r.transcript || ex.content.target_text || "", { pronunciation_score: score });
      } else if (r.tutor_turn) { setResult(null); setExercise(r.tutor_turn); shownAt.current = Date.now(); }
      void refreshState();
    } catch (e) { if ((e as { status?: number }).status === 403) navigation.navigate("Consent", { mode: "voice" }); }
    finally { setThinking(false); }
  }, [api, language, navigation, submit]);
  const rec = useRecorder(() => { void rec.stop().then(sendClip); });
  const mic: MicControls = useMemo(() => ({
    recording: rec.recording, level: rec.level, denied: rec.permission === "denied",
    async start() {
      if (!user?.profile.consents.voice_processing) { navigation.navigate("Consent", { mode: "voice" }); return; }
      stopPlayback(); stopLocalSpeech(); avatar.cancel(); setSpeaking(false); // Barge-in
      await rec.start(!!settings?.auto_vad);
    },
    async stop() { await sendClip(await rec.stop()); },
  }), [rec, user, navigation, avatar, settings?.auto_vad, sendClip]);

  const next = async () => {
    if (answered >= LESSON_LENGTH) {
      const { events, stats } = await finishLesson();
      const then: Celebration[] = [];
      const lvl = events.find((e) => e.type === "level.up");
      if (lvl && lvl.type === "level.up") then.push({ kind: "levelup", value: lvl.payload.level });
      const st = events.find((e) => e.type === "streak.updated");
      if (st && st.type === "streak.updated") then.push({ kind: "streak", value: st.payload.days });
      startLesson();
      navigation.navigate("LessonEnd", { xp: stats.xp + 15, mistakes: stats.mistakes, minutes: stats.minutes, then });
      void load();
    } else void load();
  };

  const Renderer = exercise ? registry[exercise.type] : null;
  const l = user?.learning;
  const confetti = fb.lastAnimation.name.startsWith("confetti") ? fb.lastAnimation : { name: "none", n: 0 };

  return (
    <View style={{ flex: 1, backgroundColor: th.colors.bg }}>
      <Confetti trigger={confetti.n} big={confetti.name === "confetti_big"} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: th.space.lg, paddingTop: 56, gap: th.space.md, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* oben: Speaker-Toggle links, Profil rechts */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Chip testID="speaker-toggle" label={`${t("main.speaker")}: ${settings?.avatar_voice ?? true ? "●" : "○"}`} accessibilityLabel={t("settings.avatarVoice")} onPress={() => { void patchProfile({ settings: { avatar_voice: !(settings?.avatar_voice ?? true) } }); if (settings?.avatar_voice) { stopPlayback(); stopLocalSpeech(); } }} />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {testMode && <Chip label={t("common.testMode")} bg="surfaceAlt" fg="textMuted" />}
            <Chip testID="profile-button" label={t("main.profile")} onPress={() => navigation.navigate("Profile")} />
          </View>
        </View>
        {offline && <Text center color="textMuted" accessibilityLiveRegion="polite">{t("common.offline")}</Text>}
        {budgetLimited && <Text center color="textMuted">{t("main.budgetFallback")}</Text>}
        {/* oberes Drittel: Avatar mit rundem Sprach-Badge (Tap = Sprachwechsel) */}
        <View style={{ alignItems: "center" }}>
          <AvatarView state={avatar.state} size={170} />
          <Pressable testID="language-badge" accessibilityRole="button" accessibilityLabel={t("main.switchLanguage")} onPress={() => navigation.navigate("Language", { mode: "switch" })} style={{ position: "absolute", right: "28%", bottom: 0 }}>
            <LanguageBadge badge={lang?.badge ?? "??"} size={52} />
          </Pressable>
        </View>
        {/* Untertitel mit Uebersetzungs-Toggle */}
        <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surface, gap: 4, minHeight: 72 }} accessibilityLiveRegion="polite">
          <Text testID="subtitle" variant="bodyLg" weight="bold" center>{thinking ? t("main.thinking") : subtitle.text}</Text>
          {settings?.show_translation && subtitle.translation ? <Text variant="caption" color="textMuted" center>{subtitle.translation}</Text> : null}
          <View style={{ alignItems: "center" }}><Chip testID="translation-toggle" label={settings?.show_translation ? t("main.translation.on") : t("main.translation.off")} bg="surfaceAlt" fg="primary" onPress={() => void patchProfile({ settings: { show_translation: !settings?.show_translation } })} /></View>
        </View>
        {/* untere Haelfte: Uebung (Renderer-Registry) */}
        {loading && !exercise ? <ActivityIndicator color={th.colors.primary} /> : Renderer && exercise ? (
          <Renderer key={exercise.id} exercise={exercise} result={result} showTranslation={!!settings?.show_translation}
            onSubmit={(a, m) => void submit(a, m)} onPlay={(text, slow) => say(text, !slow ? exercise.prompt.audio_url ?? null : null, !!slow)} mic={mic}
            onRoleplaySend={async (text) => { const r = await api.voiceTurn({ language, text, scenario_id: "cafe" }); bus.emitAll(r.events); const sp = r.events.find((e) => e.type === "avatar.speak"); return sp && sp.type === "avatar.speak" ? sp.payload.text : null; }} />
        ) : <Button label={t("common.retry")} onPress={() => void load()} />}
        {result && exercise && exercise.item_id !== "llm.turn" ? (
          <Chip testID="explain-button" label={t("exercise.explain")} bg="surfaceAlt" fg="primary" onPress={() => {
            api.explain(language, exercise.item_id).then((r) => setSubtitle({ text: r.text || t("exercise.explain.unavailable"), translation: null })).catch(() => setSubtitle({ text: t("exercise.explain.unavailable"), translation: null }));
          }} />
        ) : null}
        {result && <Button testID="next-button" label={t("common.continue")} onPress={() => void next()} />}
      </ScrollView>
      {/* Steuerung: Wiederholen, Mikrofon, Langsamer */}
      <View style={{ paddingHorizontal: th.space.lg, paddingBottom: th.space.lg, gap: th.space.sm, backgroundColor: th.colors.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Chip testID="repeat-button" label={t("main.repeat")} onPress={() => say(lastSpoken.current.text, lastSpoken.current.url)} />
          <MicButton recording={rec.recording} level={rec.level} onStart={mic.start} onStop={mic.stop} disabled={thinking} onTap={() => { setHint(t("main.tapToTalk")); setTimeout(() => setHint(null), 2200); }} />
          <Chip testID="slower-button" label={t("main.slower")} onPress={() => say(lastSpoken.current.text, null, true)} />
        </View>
        {hint ? <Text testID="mic-tap-hint" variant="caption" color="textMuted" center accessibilityLiveRegion="polite">{hint}</Text> : null}
        {/* ganz unten: Herzen, Tagesziel, Streak */}
        {l && <StatBar hearts={l.hearts} unlimited={l.unlimited_hearts} xp={l.daily_xp} xpTarget={l.daily_xp_target} streak={l.streak_days} />}
        <Text variant="caption" color="textMuted" center>{t("ai.notice")}</Text>
      </View>
      <HeartsEmptySheet visible={showHearts} onClose={() => { setShowHearts(false); dismissPaywall(); }}
        onSpeak={() => { setShowHearts(false); dismissPaywall(); void load(); }}
        onAd={async () => { if (await watchRewardedAd()) { setShowHearts(false); dismissPaywall(); } }}
        onPro={() => { setShowHearts(false); dismissPaywall(); navigation.navigate("Paywall", { trigger: "hearts_empty" }); }} />
    </View>
  );
}

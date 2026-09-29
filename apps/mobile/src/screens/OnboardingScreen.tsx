import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { OptionCard } from "../components/OptionCard";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { buildQuestions } from "../onboarding/questions";
import { completeOnboarding } from "../state/controller";
import { useApp } from "../state/store";
import { useTheme } from "../theme";
import type { OnboardingInput } from "../api/types";

type Step = "level" | "adaptive" | "goal" | "daily";
const LEVELS = ["none", "few_words", "simple_conversations", "everyday"] as const;
const GOALS = ["travel", "work", "family", "fun"] as const;
const DAILY = [5, 10, 15, 20] as const;

/** Onboarding im Gespraech (60-90 s): Selbsteinschaetzung, 2-3 adaptive Fragen, Ziel, Tagesziel. Ergebnis: Lernplan. */
export function OnboardingScreen() {
  const th = useTheme();
  const { t, locale } = useI18n();
  const language = useApp((s) => s.language)!;
  const langName = useApp((s) => s.languages.find((l) => l.code === s.language)?.native_name ?? "");
  const questions = useMemo(() => buildQuestions(language, locale, 3), [language, locale]);
  const [step, setStep] = useState<Step>("level");
  const [level, setLevel] = useState<OnboardingInput["self_level"] | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<{ item_id: string; correct: boolean }[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [goal, setGoal] = useState<OnboardingInput["goal"] | null>(null);
  const [daily, setDaily] = useState<OnboardingInput["daily_goal_minutes"] | null>(null);
  const [busy, setBusy] = useState(false);
  const progress = { level: 0.25, adaptive: 0.5, goal: 0.75, daily: 1 }[step];
  const q = questions[qi];

  const next = async () => {
    if (step === "level") return setStep(level === "none" ? "goal" : "adaptive"); // Anfaenger brauchen keine Testfragen
    if (step === "adaptive") {
      const ans = [...answers, { item_id: q.item_id, correct: picked === q.answer }];
      setAnswers(ans); setPicked(null);
      // adaptiv: nach falscher Antwort Fragen beenden
      if (qi + 1 >= questions.length || picked !== q.answer) return setStep("goal");
      return setQi(qi + 1);
    }
    if (step === "goal") return setStep("daily");
    setBusy(true);
    try { await completeOnboarding({ language, self_level: level!, adaptive_answers: answers, goal: goal!, daily_goal_minutes: daily! }); } finally { setBusy(false); }
  };
  const canNext = step === "level" ? !!level : step === "adaptive" ? !!picked : step === "goal" ? !!goal : !!daily;

  return (
    <Screen scroll>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: th.colors.surfaceAlt, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress * 100 }}>
        <View style={{ width: `${progress * 100}%`, height: 10, backgroundColor: th.colors.success }} />
      </View>
      <View style={{ flex: 1, gap: th.space.md, marginTop: th.space.lg }}>
        {step === "level" && <>
          <Text variant="title">{t("onboarding.level", { language: langName })}</Text>
          <Text variant="caption" color="textMuted">{t("ai.notice")}</Text>
          {LEVELS.map((l) => <OptionCard key={l} label={t(`onboarding.level.${l}`)} state={level === l ? "selected" : "default"} onPress={() => setLevel(l)} testID={`level-${l}`} />)}
        </>}
        {step === "adaptive" && <>
          <Text variant="caption" color="textMuted">{qi + 1} / {questions.length}</Text>
          <Text variant="title">{q.word}</Text>
          {q.options.map((o) => <OptionCard key={o} label={o} state={picked === o ? "selected" : "default"} onPress={() => setPicked(o)} testID={`adaptive-${o}`} />)}
        </>}
        {step === "goal" && <>
          <Text variant="title">{t("onboarding.goal")}</Text>
          {GOALS.map((g) => <OptionCard key={g} label={t(`onboarding.goal.${g}`)} state={goal === g ? "selected" : "default"} onPress={() => setGoal(g)} testID={`goal-${g}`} />)}
        </>}
        {step === "daily" && <>
          <Text variant="title">{t("onboarding.daily")}</Text>
          {DAILY.map((d) => <OptionCard key={d} label={t(`onboarding.daily.${d}`)} state={daily === d ? "selected" : "default"} onPress={() => setDaily(d)} testID={`daily-${d}`} />)}
        </>}
      </View>
      <Button testID="onboarding-next" label={t("common.continue")} disabled={!canNext} loading={busy} onPress={() => void next()} style={{ marginTop: th.space.lg }} />
    </Screen>
  );
}

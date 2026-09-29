import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useTheme } from "../theme";
import type { ExerciseResult } from "./types";

export function Prompt({ text, translation, hint }: { text: string; translation?: string | null; hint?: string | null }) {
  const { t } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      {text ? <Text variant="title" testID="exercise-prompt">{text}</Text> : null}
      {translation ? <Text color="textMuted">{translation}</Text> : null}
      {hint ? <Text variant="caption" color="textMuted">{t("exercise.hint")}: {hint}</Text> : null}
    </View>
  );
}

export function ResultBanner({ result }: { result: ExerciseResult | null }) {
  const th = useTheme();
  const { t } = useI18n();
  if (!result) return null;
  const ans = Array.isArray(result.correctAnswer) ? result.correctAnswer.join(" ") : result.correctAnswer;
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: result.correct ? th.colors.successBg : th.colors.errorBg, gap: 4 }}>
      <Text weight="bold" color={result.correct ? "success" : "error"}>{result.correct ? t("feedback.correct") : t("feedback.wrong")}</Text>
      {!result.correct && ans ? <Text>{t("feedback.correctAnswer", { answer: ans })}</Text> : null}
    </View>
  );
}

export function CheckButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return <Button label={t("common.check")} disabled={disabled} onPress={onPress} testID="check-button" />;
}

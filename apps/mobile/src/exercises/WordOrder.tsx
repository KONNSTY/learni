import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { CheckButton, Prompt, ResultBanner } from "./shared";
import type { RendererProps } from "./types";

export function WordOrder({ exercise, result, onSubmit }: RendererProps) {
  const th = useTheme();
  const { t } = useI18n();
  const tokens = exercise.content.tokens ?? [];
  const [chosen, setChosen] = useState<number[]>([]);
  const remaining = tokens.map((_, i) => i).filter((i) => !chosen.includes(i));
  return (
    <View style={{ gap: 12 }}>
      <Prompt text={exercise.prompt.say} hint={exercise.prompt.hint} />
      <View testID="answer-line" style={{ minHeight: 64, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, borderRadius: th.radius.md, borderWidth: 2, borderColor: result ? (result.correct ? th.colors.success : th.colors.error) : th.colors.border, backgroundColor: th.colors.surface }}>
        {chosen.map((i) => <Chip key={i} label={tokens[i]} bg="surfaceAlt" onPress={result ? undefined : () => setChosen(chosen.filter((c) => c !== i))} />)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {remaining.map((i) => <Chip key={i} label={tokens[i]} onPress={result ? undefined : () => setChosen([...chosen, i])} testID={`token-${tokens[i]}`} />)}
      </View>
      <ResultBanner result={result} />
      {!result && <><CheckButton disabled={chosen.length !== tokens.length} onPress={() => onSubmit(chosen.map((i) => tokens[i]))} /><Button variant="ghost" label={t("exercise.wordOrder.reset")} onPress={() => setChosen([])} /></>}
    </View>
  );
}

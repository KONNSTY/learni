import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { Prompt, ResultBanner } from "./shared";
import type { RendererProps } from "./types";

/** Sprechen: kein Herzverlust. Mikrofon verweigert => Tippen als Alternative. */
export function SpeakRepeat({ exercise, result, onSubmit, onPlay, mic }: RendererProps) {
  const th = useTheme();
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const target = exercise.content.target_text ?? exercise.prompt.say;
  return (
    <View style={{ gap: 12 }}>
      <Text variant="caption" color="textMuted">{t("exercise.speak.prompt")}</Text>
      <Prompt text={target} translation={exercise.prompt.translation} hint={exercise.prompt.hint} />
      <View style={{ flexDirection: "row", gap: 8 }}><Button variant="secondary" label={t("exercise.listen.play")} onPress={() => onPlay(target)} style={{ flex: 1 }} /><Button variant="ghost" label={t("main.slower")} onPress={() => onPlay(target, true)} style={{ flex: 1 }} /></View>
      {!result && (mic.denied ? (
        <View style={{ gap: 8 }}>
          <Text color="textMuted">{t("main.micDenied")}</Text>
          <TextInput testID="typed-answer" value={typed} onChangeText={setTyped} placeholder={target} placeholderTextColor={th.colors.textMuted} style={{ borderWidth: 2, borderColor: th.colors.border, borderRadius: th.radius.md, padding: 12, color: th.colors.text, backgroundColor: th.colors.surface }} />
          <Button label={t("common.check")} disabled={!typed.trim()} onPress={() => onSubmit(typed.trim())} />
        </View>
      ) : (
        <Text variant="caption" color="textMuted" center testID="mic-hint">{mic.recording ? t("main.releaseToSend") : t("exercise.speak.hold")}</Text>
      ))}
      <ResultBanner result={result} />
    </View>
  );
}

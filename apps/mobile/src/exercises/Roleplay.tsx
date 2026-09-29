import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { Prompt, ResultBanner } from "./shared";
import type { RendererProps } from "./types";

/** Rollenspiel: Tutor-Nachricht + Antwort per Sprache oder Text. Nicht entscheidbar => nie Herzverlust. */
export function Roleplay({ exercise, result, onSubmit, mic, onRoleplaySend }: RendererProps) {
  const th = useTheme();
  const { t } = useI18n();
  const [typed, setTyped] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const send = async () => { const text = typed.trim(); if (!text) return; setReply(await (onRoleplaySend?.(text) ?? Promise.resolve(null))); onSubmit(text); };
  return (
    <View style={{ gap: 12 }}>
      <Prompt text={exercise.prompt.say} />
      {reply ? <View style={{ padding: 12, borderRadius: th.radius.md, backgroundColor: th.colors.surface }}><Text>{reply}</Text></View> : null}
      {!result && (
        <View style={{ gap: 8 }}>
          <TextInput testID="roleplay-input" value={typed} onChangeText={setTyped} placeholder={t("exercise.roleplay.type")} placeholderTextColor={th.colors.textMuted} style={{ borderWidth: 2, borderColor: th.colors.border, borderRadius: th.radius.md, padding: 12, color: th.colors.text, backgroundColor: th.colors.surface }} />
          <Button label={t("exercise.roleplay.send")} disabled={!typed.trim()} onPress={send} />
          {!mic.denied && <Text variant="caption" color="textMuted" center>{mic.recording ? t("main.releaseToSend") : t("main.tapToTalk")}</Text>}
        </View>
      )}
      <ResultBanner result={result} />
    </View>
  );
}

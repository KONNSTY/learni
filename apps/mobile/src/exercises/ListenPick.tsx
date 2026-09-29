import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { OptionsExercise } from "./MultipleChoice";
import type { RendererProps } from "./types";

export function ListenPick(p: RendererProps) {
  const th = useTheme();
  const { t } = useI18n();
  useEffect(() => { p.onPlay(p.exercise.prompt.say); }, [p.exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const header = (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Pressable testID="play-button" accessibilityRole="button" accessibilityLabel={t("exercise.listen.play")} onPress={() => p.onPlay(p.exercise.prompt.say)}
        style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: th.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text weight="bold" color="primaryText">▶</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => p.onPlay(p.exercise.prompt.say, true)}><Text variant="caption" color="primary" weight="medium">{t("main.slower")}</Text></Pressable>
    </View>
  );
  return <OptionsExercise {...p} options={p.exercise.content.options ?? []} header={header} />;
}

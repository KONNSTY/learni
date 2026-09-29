import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import type { RendererProps } from "./types";

export function Flashcard({ exercise, onSubmit, onPlay, result }: RendererProps) {
  const th = useTheme();
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { onPlay(exercise.prompt.say); }, [exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ gap: 16 }}>
      <View testID="flashcard" style={{ minHeight: 160, borderRadius: th.radius.lg, backgroundColor: th.colors.surface, borderWidth: 2, borderColor: th.colors.border, alignItems: "center", justifyContent: "center", padding: th.space.lg, gap: 8 }}>
        <Text variant="display" center>{exercise.content.target_text ?? exercise.prompt.say}</Text>
        {flipped ? <Text variant="title" color="primary" center>{exercise.prompt.translation}</Text> : null}
      </View>
      {!flipped ? <Button label={t("exercise.flashcard.flip")} onPress={() => setFlipped(true)} testID="flip-button" /> : !result ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["again", "hard", "good", "easy"] as const).map((r) => <View key={r} style={{ flexBasis: "47%", flexGrow: 1 }}><Button label={t(`exercise.flashcard.${r}`)} variant={r === "again" ? "secondary" : "primary"} onPress={() => onSubmit(r)} testID={`rate-${r}`} /></View>)}
        </View>
      ) : null}
    </View>
  );
}

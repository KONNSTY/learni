import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme";

export function PronReportScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "PronReport">) {
  const th = useTheme();
  const { t } = useI18n();
  const { score, words } = route.params;
  const weakest = [...words].filter((w) => w.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  return (
    <Screen scroll>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("pron.title")}</Text>
        <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surface, gap: 10 }}>
          <Text variant="bodyLg" weight="bold">{t("pron.overall", { score: Math.round(score) })}</Text>
          {words.map((w, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text weight="medium">{w.word}</Text>
              <Chip label={String(Math.round(w.score ?? 0))} bg={(w.score ?? 0) >= 80 ? "successBg" : "surfaceAlt"} fg={(w.score ?? 0) >= 80 ? "success" : "text"} />
            </View>
          ))}
        </View>
        <View style={{ padding: th.space.md, borderRadius: th.radius.md, backgroundColor: th.colors.surfaceAlt, gap: 4 }}>
          <Text weight="bold">{t("pron.tip")}</Text>
          <Text>{weakest ? `„${weakest.word}“ – ` : ""}{t("pron.tip.body")}</Text>
        </View>
      </View>
      <View style={{ gap: th.space.sm }}>
        <Button label={t("common.continue")} onPress={() => navigation.goBack()} />
        <Text variant="caption" color="textMuted" center>{t("pron.noPenalty")}</Text>
      </View>
    </Screen>
  );
}

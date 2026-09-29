import React from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { ackAiNotice } from "../state/controller";
import { useTheme } from "../theme";

/** EU AI Act: sichtbarer Hinweis "Du sprichst mit einer KI" (vor der ersten Nutzung, dauerhaft im Hauptscreen). */
export function AiNoticeScreen() {
  const th = useTheme();
  const { t } = useI18n();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: th.space.md }}>
        <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: th.colors.primary }} />
        <Text variant="title" center>{t("ai.notice.title")}</Text>
        <Text color="textMuted" center>{t("ai.notice.body")}</Text>
      </View>
      <Button testID="ai-ok" label={t("ai.notice.ok")} onPress={() => void ackAiNotice()} />
    </Screen>
  );
}

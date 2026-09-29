import React from "react";
import { View } from "react-native";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function LoadingScreen() {
  const th = useTheme();
  const { t } = useI18n();
  return (
    <View testID="loading-screen" style={{ flex: 1, backgroundColor: th.colors.bg, alignItems: "center", justifyContent: "center", gap: th.space.md, padding: th.space.lg }}>
      <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: th.colors.primary }} />
      <Text variant="display" center>{t("app.name")}</Text>
      <Text color="textMuted" center>{t("loading.tagline")}</Text>
    </View>
  );
}

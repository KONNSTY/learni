import React, { useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { OptionCard } from "../components/OptionCard";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { patchProfile } from "../state/controller";
import { useTheme } from "../theme";

const OPTIONS = ["under_16", "16_17", "18_plus"] as const;
export function AgeGateScreen() {
  const th = useTheme();
  const { t } = useI18n();
  const [sel, setSel] = useState<(typeof OPTIONS)[number] | null>(null);
  return (
    <Screen>
      <View style={{ flex: 1, gap: th.space.md }}>
        <Text variant="title">{t("age.title")}</Text>
        <Text color="textMuted">{t("age.body")}</Text>
        {OPTIONS.map((o) => <OptionCard key={o} label={t(`age.${o}`)} state={sel === o ? "selected" : "default"} onPress={() => setSel(o)} testID={`age-${o}`} />)}
      </View>
      <Button testID="age-continue" label={t("common.continue")} disabled={!sel} onPress={() => sel && void patchProfile({ age_bracket: sel })} />
    </Screen>
  );
}

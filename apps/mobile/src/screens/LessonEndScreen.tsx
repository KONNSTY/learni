import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Confetti } from "../components/Confetti";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import { formatNumber } from "../logic/format";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme";

export function LessonEndScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "LessonEnd">) {
  const th = useTheme();
  const { t, locale } = useI18n();
  const { xp, mistakes, minutes, then } = route.params;
  const [burst, setBurst] = useState(0);
  useEffect(() => { setBurst(1); }, []);
  const cont = () => (then.length ? navigation.replace("Celebration", { items: then }) : navigation.popToTop());
  return (
    <Screen>
      <Confetti big trigger={burst} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: th.space.lg }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: th.colors.success }} />
        <Text variant="display" center testID="lesson-done">{t("lesson.done")}</Text>
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Chip label={t("lesson.xp", { n: xp })} fg="xp" /><Chip label={t("lesson.mistakes", { n: mistakes })} fg="error" /><Chip label={t("lesson.minutes", { n: formatNumber(minutes, locale) })} />
        </View>
      </View>
      <Button testID="lesson-continue" label={t("common.continue")} onPress={cont} />
    </Screen>
  );
}

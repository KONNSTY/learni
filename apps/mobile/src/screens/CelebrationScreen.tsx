import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Button } from "../components/Button";
import { Confetti } from "../components/Confetti";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { useI18n } from "../i18n";
import type { RootStackParamList } from "../navigation/types";
import { useTheme } from "../theme";

/** Streak- und Level-Up-Celebration (Flamme pulsiert / Badge-Zoom; Reduce Motion: statisch). */
export function CelebrationScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, "Celebration">) {
  const th = useTheme();
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const item = route.params.items[i];
  const scale = useSharedValue(th.reduceMotion ? 1 : 0.6);
  useEffect(() => {
    if (th.reduceMotion) { scale.value = 1; return; }
    scale.value = item.kind === "levelup" ? withSpring(1, { damping: 8 }) : withSequence(withTiming(1.15, { duration: 350 }), withTiming(1, { duration: 350 }));
  }, [i, item.kind, th.reduceMotion, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const last = i === route.params.items.length - 1;
  return (
    <Screen>
      <Confetti trigger={1 + i} big={item.kind === "levelup"} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: th.space.md }}>
        <Animated.View style={[{ width: 160, height: 160, borderRadius: 80, backgroundColor: item.kind === "streak" ? th.colors.streak : th.colors.xp }, anim]} />
        <Text variant="display" center testID="celebration-title">{item.kind === "streak" ? t("streak.title", { n: item.value }) : t("levelup.title", { level: item.value })}</Text>
        <Text color="textMuted" center>{item.kind === "streak" ? t("streak.body") : t("levelup.body")}</Text>
      </View>
      <Button testID="celebration-continue" label={item.kind === "levelup" ? t("levelup.go") : t("common.continue")} onPress={() => (last ? navigation.popToTop() : setI(i + 1))} />
    </Screen>
  );
}

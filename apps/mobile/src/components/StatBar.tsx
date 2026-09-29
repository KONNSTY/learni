import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useFeedback } from "../feedback/FeedbackProvider";
import { useCountUp } from "./AnimatedStat";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { Text } from "./Text";

interface Props { hearts: number; unlimited: boolean; xp: number; xpTarget: number; streak: number }
/** Figma: "StatBar" – ganz unten im Hauptscreen: Herzen, Tagesziel-Fortschritt, Streak. */
export function StatBar({ hearts, unlimited, xp, xpTarget, streak }: Props) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const shownXp = useCountUp(xp);
  const pct = xpTarget > 0 ? Math.min(1, shownXp / xpTarget) : 0;
  const { lastAnimation } = useFeedback();
  const s = useSharedValue(1);
  const x = useSharedValue(0);
  React.useEffect(() => {
    if (t.reduceMotion) return;
    if (lastAnimation.name === "heart_pulse") s.value = withSequence(withTiming(1.4, { duration: t.duration.fast }), withTiming(1, { duration: t.duration.fast }));
    if (lastAnimation.name === "heart_break") { s.value = withSequence(withTiming(0.6, { duration: 90 }), withTiming(1, { duration: 200 })); x.value = withSequence(withTiming(-5, { duration: 50 }), withTiming(5, { duration: 70 }), withTiming(0, { duration: 60 })); }
  }, [lastAnimation, t.reduceMotion, t.duration.fast, s, x]);
  const heartAnim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateX: x.value }] }));
  const Dot = ({ c, a }: { c: string; a?: object }) => <Animated.View style={[{ width: 16, height: 16, borderRadius: 8, backgroundColor: c }, a]} />;
  return (
    <View accessible accessibilityLabel={`${unlimited ? tr("main.hearts.unlimited") : tr("main.hearts", { n: hearts })}, ${tr("main.goal", { xp, target: xpTarget })}, ${tr("main.streak", { n: streak })}`}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: t.colors.surface, borderRadius: 22, minHeight: 44, paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Dot c={t.colors.heart} a={heartAnim} /><Text weight="bold" variant="caption">{unlimited ? "∞" : hearts}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, overflow: "hidden" }}><View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: t.colors.xp }} /></View>
        <Text variant="caption" color="textMuted" center>{tr("main.goal", { xp: shownXp, target: xpTarget })}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Dot c={t.colors.streak} /><Text weight="bold" variant="caption">{tr("main.streak", { n: streak })}</Text></View>
    </View>
  );
}

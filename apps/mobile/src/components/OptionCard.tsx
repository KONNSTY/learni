import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useFeedback } from "../feedback/FeedbackProvider";
import { useTheme, type ColorName } from "../theme";
import { Text } from "./Text";

export type OptionState = "default" | "selected" | "correct" | "wrong" | "disabled";
interface Props { label: string; state?: OptionState; onPress?: () => void; testID?: string; compact?: boolean }
const look: Record<OptionState, { bg: ColorName; border: ColorName; fg: ColorName }> = {
  default: { bg: "surface", border: "border", fg: "text" },
  selected: { bg: "surface", border: "primary", fg: "text" },
  correct: { bg: "successBg", border: "success", fg: "text" },
  wrong: { bg: "errorBg", border: "error", fg: "text" },
  disabled: { bg: "surfaceAlt", border: "border", fg: "textMuted" },
};

/** Figma: Komponente "OptionCard" mit Zuständen. Falsch => Shake (nicht bei Reduce Motion). */
export function OptionCard({ label, state = "default", onPress, testID, compact }: Props) {
  const t = useTheme();
  const fb = useFeedback();
  const x = useSharedValue(0);
  const prev = React.useRef(state);
  React.useEffect(() => {
    if (prev.current !== state && state === "wrong" && !t.reduceMotion) x.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 80 }), withTiming(-6, { duration: 80 }), withTiming(0, { duration: 70 }));
    prev.current = state;
  }, [state, t.reduceMotion, x]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const c = look[state];
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: state === "selected", disabled: state === "disabled" }}
      disabled={state === "disabled" || !onPress} onPress={() => { fb.tap(); onPress?.(); }}>
      <Animated.View style={[styles.base, compact && styles.compact, { backgroundColor: t.colors[c.bg], borderColor: t.colors[c.border], borderRadius: t.radius.md }, anim]}>
        <Text weight="medium" variant="bodyLg" color={c.fg}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({ base: { minHeight: 60, justifyContent: "center", paddingHorizontal: 20, borderWidth: 2 }, compact: { minHeight: 48, paddingHorizontal: 12 } });

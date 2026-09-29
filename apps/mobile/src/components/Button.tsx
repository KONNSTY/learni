import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useFeedback } from "../feedback/FeedbackProvider";
import { useTheme, type ColorName } from "../theme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
interface Props { label: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; testID?: string; accessibilityHint?: string }

const map: Record<ButtonVariant, { bg: ColorName; fg: ColorName; border?: ColorName }> = {
  primary: { bg: "primary", fg: "primaryText" },
  secondary: { bg: "surface", fg: "primary", border: "primary" },
  ghost: { bg: "bg", fg: "primary" },
  danger: { bg: "error", fg: "primaryText" },
};
const disabledMap: Record<ButtonVariant, { bg: ColorName; fg: ColorName }> = {
  primary: { bg: "border", fg: "textMuted" }, secondary: { bg: "surfaceAlt", fg: "textMuted" }, ghost: { bg: "bg", fg: "textMuted" }, danger: { bg: "border", fg: "textMuted" },
};

/** Figma: Komponente "Button" (Type × State). Pop-Animation + Tap-Sound + leichte Haptik (Reduce Motion: kein Scale). */
export function Button({ label, onPress, variant = "primary", disabled, loading, style, testID, accessibilityHint }: Props) {
  const t = useTheme();
  const fb = useFeedback();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const c = disabled ? disabledMap[variant] : map[variant];
  const border = !disabled && variant === "secondary" ? t.colors.primary : "transparent";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPressIn={() => { if (!t.reduceMotion) scale.value = withTiming(0.96, { duration: t.duration.instant }); }}
      onPressOut={() => { if (!t.reduceMotion) scale.value = withSpring(1, { damping: 12, stiffness: 220 }); }}
      onPress={() => { fb.tap(); onPress?.(); }}
    >
      <Animated.View style={[styles.base, { backgroundColor: t.colors[c.bg], borderColor: border, borderRadius: t.radius.md, paddingHorizontal: t.space.lg }, style, anim]}>
        <Text weight="bold" variant="bodyLg" color={c.fg}>{loading ? "…" : label}</Text>
        <View />
      </Animated.View>
    </Pressable>
  );
}
const styles = StyleSheet.create({ base: { minHeight: 56, alignItems: "center", justifyContent: "center", borderWidth: 2 } });

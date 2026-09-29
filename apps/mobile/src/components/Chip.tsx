import React from "react";
import { Pressable } from "react-native";
import { useFeedback } from "../feedback/FeedbackProvider";
import { useTheme, type ColorName } from "../theme";
import { Text } from "./Text";

export function Chip({ label, onPress, bg = "surface", fg = "text", testID, accessibilityLabel }: { label: string; onPress?: () => void; bg?: ColorName; fg?: ColorName; testID?: string; accessibilityLabel?: string }) {
  const t = useTheme();
  const fb = useFeedback();
  return (
    <Pressable testID={testID} accessibilityRole={onPress ? "button" : "text"} accessibilityLabel={accessibilityLabel ?? label} disabled={!onPress} hitSlop={8}
      onPress={() => { fb.tap(); onPress?.(); }}
      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: t.radius.pill, backgroundColor: t.colors[bg], alignItems: "center", justifyContent: "center" }}>
      <Text weight="medium" variant="caption" color={fg}>{label}</Text>
    </Pressable>
  );
}

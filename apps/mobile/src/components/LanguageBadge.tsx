import React from "react";
import { View } from "react-native";
import { useTheme } from "../theme";
import { Text } from "./Text";

/** Icon + Sprachkürzel. Nie eine Länderflagge als alleiniges Symbol. Regionsvariante optional (z. B. "BR"). */
export function LanguageBadge({ badge, size = 48, variant }: { badge: string; size?: number; variant?: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={`${badge}${variant ? " " + variant : ""}`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: t.colors.surface }}>
      <Text weight="bold" color="primaryText" style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) }}>{badge}</Text>
      {variant ? <Text weight="bold" color="primaryText" style={{ fontSize: Math.round(size * 0.2), lineHeight: Math.round(size * 0.24) }}>{variant}</Text> : null}
    </View>
  );
}

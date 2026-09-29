import React from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

export function Screen({ children, scroll, style, padded = true }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle; padded?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + t.space.md, paddingBottom: insets.bottom + t.space.md, paddingHorizontal: padded ? t.space.lg : 0 };
  if (scroll) return <ScrollView style={{ backgroundColor: t.colors.bg }} contentContainerStyle={[pad, styles.grow, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
  return <View style={[{ flex: 1, backgroundColor: t.colors.bg }, pad, style]}>{children}</View>;
}
const styles = StyleSheet.create({ grow: { flexGrow: 1 } });

import React from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={t.reduceMotion ? "none" : "slide"} onRequestClose={onClose}>
      <Pressable accessibilityLabel="close" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, padding: t.space.lg, paddingBottom: insets.bottom + t.space.lg, gap: t.space.md, alignItems: "center" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border }} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

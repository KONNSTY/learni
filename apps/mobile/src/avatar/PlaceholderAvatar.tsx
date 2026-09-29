import React from "react";
import { View } from "react-native";
import { useTheme } from "../theme";
import type { AvatarState } from "./controller";
import { MOUTH_OPEN } from "./visemes";

/** 2D-Platzhalter mit demselben Input-Vertrag wie ein Rive-Avatar (Viseme 0..21, Emotion, Blick, speaking). */
export function PlaceholderAvatar({ state, size = 200 }: { state: AvatarState; size?: number }) {
  const t = useTheme();
  const open = MOUTH_OPEN[state.viseme] ?? 0;
  const eye = Math.round(size * 0.09);
  const eyeH = state.emotion === "happy" || state.emotion === "celebrate" ? Math.round(eye * 0.5) : state.emotion === "surprised" ? Math.round(eye * 1.4) : eye;
  const browTilt = state.emotion === "sad" ? "12deg" : state.emotion === "thinking" ? "-10deg" : "0deg";
  const mouthW = Math.round(size * (state.viseme === 7 || state.viseme === 8 ? 0.14 : 0.26));
  const mouthH = Math.max(4, Math.round(size * 0.22 * open));
  const face = state.emotion === "celebrate" ? t.colors.warning : t.colors.surfaceAlt;
  return (
    <View accessible accessibilityLabel="Avatar" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: face, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: t.colors.border }}>
      <View style={{ flexDirection: "row", gap: size * 0.2, marginBottom: size * 0.1, transform: [{ translateX: state.gazeX * size * 0.03 }, { translateY: state.gazeY * size * 0.03 }] }}>
        {[0, 1].map((i) => <View key={i} style={{ width: eye, height: eyeH, borderRadius: eye / 2, backgroundColor: t.colors.text, transform: [{ rotate: i ? browTilt : `-${browTilt}` }] }} />)}
      </View>
      <View testID="avatar-mouth" style={{ width: mouthW, height: mouthH, borderRadius: mouthH / 2 + 2, backgroundColor: state.speaking || open > 0 ? t.colors.error : t.colors.text }} />
    </View>
  );
}

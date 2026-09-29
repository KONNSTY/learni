import type { HapticKind } from "./feedbackMap";

export function playHaptic(kind: HapticKind): void {
  if (kind === "none") return;
  try {
    const H = require("expo-haptics") as typeof import("expo-haptics");
    switch (kind) {
      case "light": void H.impactAsync(H.ImpactFeedbackStyle.Light); break;
      case "soft": void H.impactAsync(H.ImpactFeedbackStyle.Soft); break;
      case "medium": void H.impactAsync(H.ImpactFeedbackStyle.Medium); break;
      case "heavy": void H.impactAsync(H.ImpactFeedbackStyle.Heavy); break;
      case "success": void H.notificationAsync(H.NotificationFeedbackType.Success); break;
      case "error": void H.notificationAsync(H.NotificationFeedbackType.Error); break;
    }
  } catch { /* Geraet ohne Haptik */ }
}

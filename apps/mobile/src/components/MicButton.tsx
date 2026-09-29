import React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useFeedback } from "../feedback/FeedbackProvider";
import { MIC_OFF, MIC_ON } from "../feedback/feedbackMap";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import { Text } from "./Text";

interface Props { recording: boolean; level: number; onStart: () => Promise<void> | void; onStop: () => Promise<void> | void; disabled?: boolean }
/** Push-to-talk (Halten). Figma: MicButton Idle/Listening/Disabled. Pegel skaliert den Ring (nicht bei Reduce Motion). */
export function MicButton({ recording, level, onStart, onStop, disabled }: Props) {
  const th = useTheme();
  const fb = useFeedback();
  const { t } = useI18n();
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(recording && !th.reduceMotion ? 1 + Math.min(level * 6, 0.5) : 1, { duration: 90 }) }] }));
  const bg = disabled ? th.colors.border : recording ? th.colors.error : th.colors.primary;
  return (
    <Pressable testID="mic-button" accessibilityRole="button" accessibilityLabel={t("main.mic")} accessibilityHint={t("main.tapToTalk")} accessibilityState={{ disabled: !!disabled, busy: recording }}
      disabled={disabled} onPressIn={() => { fb.play(MIC_ON); void onStart(); }} onPressOut={() => { if (recording) { fb.play(MIC_OFF); void onStop(); } }}>
      <Animated.View style={[{ width: 88, height: 88, borderRadius: 44, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, ring]}>
        <Text weight="bold" color="primaryText">{recording ? "●" : "MIC"}</Text>
      </Animated.View>
    </Pressable>
  );
}

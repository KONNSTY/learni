import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

const COLORS = ["primary", "success", "warning", "heart", "xp", "streak"] as const;
function Piece({ i, big, color, trigger }: { i: number; big: boolean; color: string; trigger: number }) {
  const p = useSharedValue(0);
  const cfg = useMemo(() => ({ dx: (((i * 37) % 100) / 100 - 0.5) * (big ? 360 : 220), dy: 160 + ((i * 53) % 100) * (big ? 4 : 2), rot: (i % 2 ? 1 : -1) * (180 + ((i * 29) % 180)), delay: (i % 6) * 25 }), [i, big]);
  useEffect(() => { p.value = 0; p.value = withDelay(cfg.delay, withTiming(1, { duration: big ? 1400 : 900, easing: Easing.out(Easing.quad) })); }, [trigger, big, cfg.delay, p]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateX: cfg.dx * p.value }, { translateY: -80 + cfg.dy * p.value * p.value + -120 * (1 - p.value) * p.value }, { rotate: `${cfg.rot * p.value}deg` }] }));
  return <Animated.View style={[styles.piece, { backgroundColor: color }, style]} />;
}

/** Konfetti-Burst. Bei Reduce Motion wird nichts gerendert (statischer Screen). */
export function Confetti({ big = false, trigger }: { big?: boolean; trigger: number }) {
  const t = useTheme();
  if (t.reduceMotion || trigger === 0) return null;
  const n = big ? 36 : 14;
  return <View pointerEvents="none" style={styles.wrap}>{Array.from({ length: n }, (_, i) => <Piece key={`${trigger}-${i}`} i={i} big={big} trigger={trigger} color={t.colors[COLORS[i % COLORS.length]]} />)}</View>;
}
const styles = StyleSheet.create({ wrap: { position: "absolute", top: 0, left: 0, right: 0, height: 1, alignItems: "center", zIndex: 10 }, piece: { position: "absolute", width: 10, height: 14, borderRadius: 2 } });

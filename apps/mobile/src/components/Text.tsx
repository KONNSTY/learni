import React from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme, type ColorName } from "../theme";

type Variant = "display" | "title" | "bodyLg" | "body" | "caption";
interface Props extends TextProps { variant?: Variant; color?: ColorName; weight?: "regular" | "medium" | "bold"; center?: boolean }

export function Text({ variant = "body", color = "text", weight, center, style, ...rest }: Props) {
  const t = useTheme();
  const size = t.font.size[variant];
  const w = weight ?? (variant === "display" || variant === "title" ? "bold" : "regular");
  const s: TextStyle = { color: t.colors[color], fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: t.font.weight[w] as TextStyle["fontWeight"], textAlign: center ? "center" : undefined };
  // allowFontScaling bleibt an: Dynamic Type wird respektiert
  return <RNText {...rest} style={[s, style]} maxFontSizeMultiplier={1.4} />;
}

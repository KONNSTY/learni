import { tokens } from "./tokens.generated";

export type ThemeMode = "system" | "light" | "dark";
export type ColorName = keyof typeof tokens.color.light;

export interface Theme {
  scheme: "light" | "dark";
  colors: Record<ColorName, string>;
  space: typeof tokens.space;
  radius: typeof tokens.radius;
  font: typeof tokens.font;
  /** Dauern in ms; bei Reduce Motion alle 0 (Figma: Collection "Motion Reduce"). */
  duration: Record<keyof typeof tokens.motion.duration, number>;
  easing: typeof tokens.motion.easing;
  reduceMotion: boolean;
}

export function buildTheme(scheme: "light" | "dark", reduceMotion: boolean): Theme {
  const d = tokens.motion.duration;
  const zero = tokens.motion.reduceMotionDuration;
  return {
    scheme,
    colors: { ...tokens.color[scheme] },
    space: tokens.space,
    radius: tokens.radius,
    font: tokens.font,
    duration: reduceMotion ? { instant: zero, fast: zero, base: zero, slow: zero } : { ...d },
    easing: tokens.motion.easing,
    reduceMotion,
  };
}


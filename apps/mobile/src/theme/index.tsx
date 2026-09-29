import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import { buildTheme, type Theme, type ThemeMode } from "./build";
import { tokens } from "./tokens.generated";

export type { Theme, ThemeMode, ColorName } from "./build";
interface Ctx { theme: Theme; mode: ThemeMode; setMode: (m: ThemeMode) => void }
const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children, initialMode = "system" }: { children: React.ReactNode; initialMode?: ThemeMode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { alive = false; sub.remove(); };
  }, []);
  const scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const value = useMemo(() => ({ theme: buildTheme(scheme, reduce), mode, setMode }), [scheme, reduce, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c.theme;
}
export function useThemeMode() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useThemeMode outside ThemeProvider");
  return { mode: c.mode, setMode: c.setMode };
}
export { tokens };

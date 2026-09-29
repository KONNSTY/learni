import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme";
import { Text } from "./Text";

/** XP-Zaehler: zaehlt hoch (480 ms, Figma "slow"); bei Reduce Motion springt der Wert. */
export function useCountUp(value: number): number {
  const th = useTheme();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (th.reduceMotion || value === from.current) { setShown(value); from.current = value; return; }
    const start = Date.now(), a = from.current, dur = th.duration.slow;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const tick = () => { const p = Math.min(1, (Date.now() - start) / dur); setShown(Math.round(a + (value - a) * p)); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, th.reduceMotion, th.duration.slow]);
  return shown;
}
export function CountUpText({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const v = useCountUp(value);
  return <Text weight="bold">{prefix}{v}{suffix}</Text>;
}

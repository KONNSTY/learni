import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { bus } from "../events/bus";
import type { LearniEvent } from "../events/types";
import { useTheme } from "../theme";
import { useApp } from "../state/store";
import { applyPrefs, extraFor, feedbackFor, TAP, type AnimationName, type Feedback } from "./feedbackMap";
import { playHaptic } from "./haptics";
import { playSfx, preloadSfx } from "./sfx";

interface Ctx { play: (f: Feedback) => void; tap: () => void; lastAnimation: { name: AnimationName; n: number } }
const FeedbackContext = createContext<Ctx | null>(null);

/** Setzt semantische Backend-Events in Klang, Haptik und Animation-Signale um (nur hier entscheidet das Frontend). */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const settings = useApp((s) => s.user?.profile.settings);
  const prefsRef = useRef({ sfx: true, haptics: true, reduceMotion: false, systemMuted: false });
  prefsRef.current = { sfx: settings?.sfx ?? true, haptics: settings?.haptics ?? true, reduceMotion: theme.reduceMotion, systemMuted: false };
  const [lastAnimation, setLast] = useState<{ name: AnimationName; n: number }>({ name: "none", n: 0 });

  useEffect(() => { void preloadSfx(); }, []);
  const play = useCallback((f: Feedback) => {
    const a = applyPrefs(f, prefsRef.current);
    if (a.sfx) playSfx(a.sfx);
    playHaptic(a.haptic);
    if (a.animation !== "none") setLast((p) => ({ name: a.animation, n: p.n + 1 }));
  }, []);
  useEffect(() => bus.onAny((e: LearniEvent) => { const f = feedbackFor(e); if (f) play(f); const x = extraFor(e); if (x) play(x); }), [play]);
  const value = useMemo<Ctx>(() => ({ play, tap: () => play(TAP), lastAnimation }), [play, lastAnimation]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): Ctx {
  const c = useContext(FeedbackContext);
  if (!c) throw new Error("useFeedback outside FeedbackProvider");
  return c;
}

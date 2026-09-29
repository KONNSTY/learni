import { useCallback, useEffect, useRef, useState } from "react";
import type { Emotion } from "../events/types";
import { clampViseme, type VisemeEvent } from "./visemes";

export interface AvatarState { viseme: number; emotion: Emotion; gazeX: number; gazeY: number; speaking: boolean }
export const idleAvatar: AvatarState = { viseme: 0, emotion: "neutral", gazeX: 0, gazeY: 0, speaking: false };

/** Plant Viseme-Wechsel als Timer relativ zum Audio-Start. `cancel()` = Barge-in (Nutzer unterbricht den Tutor). */
export function useAvatarController() {
  const [state, setState] = useState<AvatarState>(idleAvatar);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);

  const cancel = useCallback(() => { clear(); setState((s) => ({ ...s, viseme: 0, speaking: false })); }, []);
  const setEmotion = useCallback((emotion: Emotion) => setState((s) => ({ ...s, emotion })), []);
  const lookAt = useCallback((gazeX: number, gazeY: number) => setState((s) => ({ ...s, gazeX: Math.max(-1, Math.min(1, gazeX)), gazeY: Math.max(-1, Math.min(1, gazeY)) })), []);

  /** `offsetMs`: Audio-Startlatenz; Zeitstrahl kommt vom Backend (avatar.speak.visemes). */
  const speak = useCallback((visemes: VisemeEvent[], emotion: Emotion, offsetMs = 0, onDone?: () => void) => {
    clear();
    setState((s) => ({ ...s, emotion, speaking: true }));
    for (const v of visemes) timers.current.push(setTimeout(() => setState((s) => ({ ...s, viseme: clampViseme(v.viseme) })), Math.max(0, v.t_ms + offsetMs)));
    const end = (visemes.length ? visemes[visemes.length - 1].t_ms : 0) + offsetMs + 120;
    timers.current.push(setTimeout(() => { setState((s) => ({ ...s, viseme: 0, speaking: false })); onDone?.(); }, end));
  }, []);

  return { state, speak, cancel, setEmotion, lookAt };
}

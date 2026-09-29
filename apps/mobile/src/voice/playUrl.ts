import { createAudioPlayer } from "expo-audio";

let current: ReturnType<typeof createAudioPlayer> | null = null;
/** Spielt Backend-/CDN-Audio (TTS-Cache). Barge-in: stopPlayback(). */
export function playUrl(url: string, onDone?: () => void): void {
  stopPlayback();
  try {
    const p = createAudioPlayer({ uri: url });
    current = p;
    const sub = p.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => { if (s.didJustFinish) { sub.remove(); p.remove(); if (current === p) current = null; onDone?.(); } });
    p.play();
  } catch { onDone?.(); }
}
export function stopPlayback(): void {
  try { current?.pause(); current?.remove(); } catch { /* */ }
  current = null;
}

/** Energiebasierte VAD-Logik (rein, testbar). Frames = RMS-Pegel 0..1 in fester Taktung. */
export interface VadConfig { threshold: number; minSpeechFrames: number; silenceFramesToStop: number; maxFrames: number }
export const defaultVad: VadConfig = { threshold: 0.06, minSpeechFrames: 3, silenceFramesToStop: 8, maxFrames: 300 };

export type VadState = { speechFrames: number; silenceFrames: number; total: number; speaking: boolean; done: boolean };
export const vadInit = (): VadState => ({ speechFrames: 0, silenceFrames: 0, total: 0, speaking: false, done: false });

export function vadStep(s: VadState, level: number, c: VadConfig = defaultVad): VadState {
  if (s.done) return s;
  const loud = level >= c.threshold;
  const next: VadState = { ...s, total: s.total + 1 };
  if (loud) { next.speechFrames += 1; next.silenceFrames = 0; } else if (s.speaking) { next.silenceFrames += 1; }
  next.speaking = next.speechFrames >= c.minSpeechFrames;
  next.done = (next.speaking && next.silenceFrames >= c.silenceFramesToStop) || next.total >= c.maxFrames;
  return next;
}

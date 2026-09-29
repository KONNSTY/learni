// "Tutor spricht"-Flag verschiebt Paywalls/Werbung (nie mitten im Sprechfluss). Laeuft das Sprach-Ende-Callback nie ein
// (Plattform/Fehler), laeuft das Flag ab, damit nichts dauerhaft blockiert.
export const SPEAKING_TTL_MS = 12_000;
let since: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

export const isSpeaking = (now = Date.now()) => since !== null && now - since < SPEAKING_TTL_MS;
export function setSpeaking(v: boolean, now = Date.now()): void {
  const was = isSpeaking(now);
  since = v ? now : null;
  if (timer) { clearTimeout(timer); timer = null; }
  if (v) timer = setTimeout(() => { since = null; listeners.forEach((f) => f()); }, SPEAKING_TTL_MS + 5);
  else if (was) listeners.forEach((f) => f());
}
/** Wird aufgerufen, sobald der Tutor fertig ist (oder das Flag abgelaufen ist). */
export function onSpeakingEnd(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }

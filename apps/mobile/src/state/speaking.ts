// "Tutor spricht"-Flag blockiert Paywalls/Werbung nur begrenzt: laeuft das Sprach-Ende-Callback nie ein (Plattform/Fehler), laeuft das Flag ab.
export const SPEAKING_TTL_MS = 12_000;
let since: number | null = null;
export const setSpeaking = (v: boolean, now = Date.now()) => { since = v ? now : null; };
export const isSpeaking = (now = Date.now()) => since !== null && now - since < SPEAKING_TTL_MS;

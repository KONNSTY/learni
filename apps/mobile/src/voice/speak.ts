import * as Speech from "expo-speech";

/** Lokaler Test-TTS (Mock-Modus, kein Backend/Key noetig). Gibt die geschaetzte Dauer zurueck. */
export function speakLocal(text: string, language: string, slow: boolean, onDone?: () => void): void {
  try {
    Speech.stop();
    Speech.speak(text, { language, rate: slow ? 0.7 : 0.95, onDone, onStopped: onDone, onError: onDone });
  } catch { onDone?.(); }
}
export const stopLocalSpeech = () => { try { void Speech.stop(); } catch { /* */ } };

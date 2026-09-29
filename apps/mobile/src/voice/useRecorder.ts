import { AudioQuality, IOSOutputFormat, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { bytesToBase64 } from "../logic/base64";
import { defaultVad, vadInit, vadStep, type VadState } from "../logic/vad";

export type MicPermission = "unknown" | "granted" | "denied";
export interface Clip { base64: string; seconds: number; mime: string }

// iOS: 16-kHz-Linear-PCM-WAV (Server kann Stille per RMS filtern). Android: AAC/M4A (Server akzeptiert beides).
const OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".wav", sampleRate: 16000, numberOfChannels: 1, isMeteringEnabled: true,
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, extension: ".wav", outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.HIGH, sampleRate: 16000 },
  android: { ...RecordingPresets.HIGH_QUALITY.android, extension: ".m4a", sampleRate: 16000 },
};

/** Push-to-talk und Auto-VAD. Die Datei wird sofort nach dem Lesen geloescht (Audio wird nie gespeichert). */
export function useRecorder(onAutoStop?: () => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const vad = useRef<VadState>(vadInit());
  const useVad = useRef(false);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    try {
      const r = await requestRecordingPermissionsAsync();
      setPermission(r.granted ? "granted" : "denied");
      return r.granted;
    } catch { setPermission("denied"); return false; }
  }, []);

  const start = useCallback(async (autoVad = false): Promise<boolean> => {
    if (!(await ensurePermission())) return false;
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      vad.current = vadInit(); useVad.current = autoVad; setRecording(true);
      poll.current = setInterval(() => {
        const db = recorder.getStatus().metering ?? -160;
        const lin = Math.pow(10, db / 20);
        setLevel(lin);
        if (useVad.current) {
          vad.current = vadStep(vad.current, lin, defaultVad);
          if (vad.current.done) { useVad.current = false; onAutoStop?.(); }
        }
      }, 100);
      return true;
    } catch { setRecording(false); return false; }
  }, [ensurePermission, onAutoStop, recorder]);

  const stop = useCallback(async (): Promise<Clip | null> => {
    if (poll.current) { clearInterval(poll.current); poll.current = null; }
    setRecording(false); setLevel(0);
    try {
      const seconds = Math.max(0, recorder.getStatus().durationMillis / 1000);
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false });
      if (!uri) return null;
      const file = new File(uri);
      const bytes = new Uint8Array(await file.arrayBuffer());
      try { file.delete(); } catch { /* best effort */ }
      return { base64: bytesToBase64(bytes), seconds, mime: uri.endsWith(".wav") ? "audio/wav" : "audio/mp4" };
    } catch { return null; }
  }, [recorder]);

  return { permission, recording, level, start, stop, ensurePermission };
}

import type { Exercise } from "../api/types";

export interface ExerciseResult { correct: boolean; correctAnswer?: string | string[] | null }
export interface MicControls { recording: boolean; level: number; denied: boolean; start(): Promise<void>; stop(): Promise<void> }
/** Vertrag zwischen Uebungs-Daten (Backend) und Renderer (Frontend): Uebungen sind Daten, jeder `type` hat genau einen Renderer. */
export interface RendererProps {
  exercise: Exercise;
  result: ExerciseResult | null;
  onSubmit: (answer: string | string[], meta?: { pronunciation_score?: number }) => void;
  onPlay: (text: string, slow?: boolean) => void;
  mic: MicControls;
  showTranslation: boolean;
  onRoleplaySend?: (text: string) => Promise<string | null>;
}
export type ExerciseType = Exercise["type"];

import type React from "react";
import { FillBlank } from "./FillBlank";
import { Flashcard } from "./Flashcard";
import { ListenPick } from "./ListenPick";
import { Matching } from "./Matching";
import { MultipleChoice } from "./MultipleChoice";
import { Roleplay } from "./Roleplay";
import { SpeakRepeat } from "./SpeakRepeat";
import type { ExerciseType, RendererProps } from "./types";
import { WordOrder } from "./WordOrder";

/** Renderer-Registry: Backend liefert Uebungen als Daten (exercise.schema.json), Frontend rendert je `type`.
 *  Neuer Typ = Schema erweitern + hier registrieren. `Record<ExerciseType, …>` erzwingt Vollstaendigkeit beim Kompilieren. */
export const registry: Record<ExerciseType, React.ComponentType<RendererProps>> = {
  multiple_choice: MultipleChoice,
  matching: Matching,
  fill_blank: FillBlank,
  listen_pick: ListenPick,
  speak_repeat: SpeakRepeat,
  word_order: WordOrder,
  roleplay: Roleplay,
  flashcard: Flashcard,
};

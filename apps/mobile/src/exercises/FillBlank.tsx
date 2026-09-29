import React from "react";
import { Prompt } from "./shared";
import { OptionsExercise } from "./MultipleChoice";
import type { RendererProps } from "./types";

export function FillBlank(p: RendererProps) {
  const sentence = (p.exercise.content.sentence_with_blank ?? p.exercise.prompt.say).replace("___", "＿＿＿");
  return <OptionsExercise {...p} options={p.exercise.content.options ?? []} header={<Prompt text={sentence} translation={p.showTranslation ? p.exercise.prompt.translation : null} hint={p.exercise.prompt.hint} />} />;
}

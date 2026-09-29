import React, { useState } from "react";
import { View } from "react-native";
import { OptionCard, type OptionState } from "../components/OptionCard";
import { CheckButton, Prompt, ResultBanner } from "./shared";
import type { RendererProps } from "./types";

/** Auswahl (multiple_choice) – auch Basis fuer fill_blank und listen_pick. */
export function OptionsExercise({ exercise, result, onSubmit, options, header }: RendererProps & { options: string[]; header?: React.ReactNode }) {
  const [picked, setPicked] = useState<string | null>(null);
  const stateOf = (o: string): OptionState => {
    if (!result) return picked === o ? "selected" : "default";
    const correct = Array.isArray(result.correctAnswer) ? false : result.correctAnswer;
    if (result.correct && picked === o) return "correct";
    if (!result.correct && picked === o) return "wrong";
    if (!result.correct && correct === o) return "correct";
    return "disabled";
  };
  return (
    <View style={{ gap: 12 }}>
      {header ?? <Prompt text={exercise.prompt.say} translation={exercise.prompt.translation} hint={exercise.prompt.hint} />}
      {options.map((o) => <OptionCard key={o} label={o} state={stateOf(o)} onPress={result ? undefined : () => setPicked(o)} testID={`option-${o}`} />)}
      <ResultBanner result={result} />
      {!result && <CheckButton disabled={picked === null} onPress={() => picked !== null && onSubmit(picked)} />}
    </View>
  );
}

export function MultipleChoice(p: RendererProps) { return <OptionsExercise {...p} options={p.exercise.content.options ?? []} />; }

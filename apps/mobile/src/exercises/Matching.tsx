import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { OptionCard, type OptionState } from "../components/OptionCard";
import { CheckButton, Prompt, ResultBanner } from "./shared";
import type { RendererProps } from "./types";

/** Zuordnung: links tippen, dann rechts tippen. Antwort = ["links|rechts", …]. */
export function Matching({ exercise, result, onSubmit }: RendererProps) {
  const pairs = exercise.content.pairs ?? [];
  const lefts = useMemo(() => pairs.map((p) => p.left), [pairs]);
  const rights = useMemo(() => pairs.map((p) => p.right), [pairs]);
  const [left, setLeft] = useState<string | null>(null);
  const [made, setMade] = useState<Record<string, string>>({});
  const usedRight = new Set(Object.values(made));
  const pick = (r: string) => { if (left && !usedRight.has(r)) { setMade({ ...made, [left]: r }); setLeft(null); } };
  const done = Object.keys(made).length === lefts.length;
  const lState = (l: string): OptionState => (result ? "disabled" : made[l] ? "correct" : left === l ? "selected" : "default");
  const rState = (r: string): OptionState => (result ? "disabled" : usedRight.has(r) ? "correct" : "default");
  return (
    <View style={{ gap: 12 }}>
      <Prompt text={exercise.prompt.say || ""} hint={exercise.prompt.hint} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, gap: 8 }}>{lefts.map((l) => <OptionCard key={l} compact label={l} state={lState(l)} onPress={made[l] || result ? undefined : () => setLeft(l)} testID={`left-${l}`} />)}</View>
        <View style={{ flex: 1, gap: 8 }}>{rights.map((r) => <OptionCard key={r} compact label={r} state={rState(r)} onPress={result || usedRight.has(r) ? undefined : () => pick(r)} testID={`right-${r}`} />)}</View>
      </View>
      <ResultBanner result={result} />
      {!result && <CheckButton disabled={!done} onPress={() => onSubmit(Object.entries(made).map(([l, r]) => `${l}|${r}`))} />}
    </View>
  );
}

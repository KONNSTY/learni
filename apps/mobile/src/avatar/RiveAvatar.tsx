import React, { useEffect } from "react";
import type { AvatarManifest } from "./manifest";
import { EMOTIONS } from "./manifest";
import type { AvatarState } from "./controller";
import { loadRive } from "./riveLoader";

/** Rive-Avatar (echtes Paket: .riv + manifest.json). Nutzt @rive-app/react-native (Nitro, braucht Dev Build).
 *  Input-Vertrag laut Manifest: viseme (0..21), emotion (Index in manifest.inputs.emotion.values), gazeX/gazeY, speaking. */
export { loadRive };

interface Props { manifest: AvatarManifest; source: number; state: AvatarState; size?: number }
export function RiveAvatar({ manifest, source, state, size = 200 }: Props) {
  const rive = loadRive();
  if (!rive) return null;
  return <RiveInner rive={rive} manifest={manifest} source={source} state={state} size={size} />;
}

function RiveInner({ rive, manifest, source, state, size }: Props & { rive: NonNullable<ReturnType<typeof loadRive>>; size: number }) {
  const { riveFile } = rive.useRiveFile(source as never) as { riveFile?: unknown };
  const { riveViewRef, setHybridRef } = rive.useRive();
  useEffect(() => {
    const v = riveViewRef as unknown as { setNumberInputValue(n: string, v: number): void; setBooleanInputValue(n: string, v: boolean): void } | null | undefined;
    if (!v) return;
    const i = manifest.inputs;
    v.setNumberInputValue(i.viseme.name, state.viseme);
    v.setNumberInputValue(i.emotion.name, Math.max(0, EMOTIONS.indexOf(state.emotion)));
    v.setNumberInputValue(i.gaze_x.name, state.gazeX);
    v.setNumberInputValue(i.gaze_y.name, state.gazeY);
    v.setBooleanInputValue(i.speaking.name, state.speaking);
  }, [riveViewRef, manifest, state]);
  if (!riveFile) return null;
  const RiveView = rive.RiveView as unknown as React.ComponentType<Record<string, unknown>>;
  return <RiveView hybridRef={setHybridRef} file={riveFile} autoPlay stateMachineName={manifest.state_machine} fit={rive.Fit.Contain} style={{ width: size, height: size }} />;
}

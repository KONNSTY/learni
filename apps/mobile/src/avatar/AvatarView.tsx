import React from "react";
import type { AvatarState } from "./controller";
import { PlaceholderAvatar } from "./PlaceholderAvatar";
import { RiveAvatar } from "./RiveAvatar";
import { loadRive } from "./riveLoader";
import { activePackage } from "./registry";

/** Wählt Rive-Paket (falls .riv + Native-Modul vorhanden) sonst den 2D-Platzhalter. */
export function AvatarView({ state, size = 200 }: { state: AvatarState; size?: number }) {
  const pkg = activePackage();
  if (pkg.riv !== null && loadRive()) return <RiveAvatar manifest={pkg.manifest} source={pkg.riv} state={state} size={size} />;
  return <PlaceholderAvatar state={state} size={size} />;
}

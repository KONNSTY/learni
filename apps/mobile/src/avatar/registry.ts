import { placeholderManifest, type AvatarManifest } from "./manifest";

export interface AvatarPackage { manifest: AvatarManifest; /** require("…/x.riv") oder null (Platzhalter ohne Rive-Datei) */ riv: number | null }

/** Avatar-Pakete. Neues Paket: Ordner apps/mobile/assets/avatars/<id>/ (manifest.json + .riv) anlegen,
 *  hier importieren und registrieren; `ACTIVE_AVATAR` umstellen. Details: docs/AVATAR_PACKAGE.md. */
export const packages: Record<string, AvatarPackage> = {
  placeholder: { manifest: placeholderManifest, riv: null },
};
export const ACTIVE_AVATAR = "placeholder";
export const activePackage = (): AvatarPackage => packages[ACTIVE_AVATAR] ?? packages.placeholder;

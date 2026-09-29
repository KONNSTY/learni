# Avatar-Paket (Rive) einsetzen

Vertrag: `packages/contracts/schemas/avatar-manifest.schema.json`, Beispiel: `packages/contracts/examples/avatar-manifest.placeholder.json`.

Ein Paket besteht aus **`<id>.riv` + `manifest.json`** mit festem Input-Vertrag der State Machine:

| Input | Typ | Bedeutung |
|---|---|---|
| `viseme` | Number 0–21 | Mundform (Azure-kompatibles Viseme-Schema, siehe `src/avatar/visemes.ts`) |
| `emotion` | Number 0–6 | Index in `manifest.inputs.emotion.values` (neutral, happy, encouraging, thinking, surprised, sad, celebrate) |
| `gazeX`, `gazeY` | Number −1…1 | Blickrichtung |
| `speaking` | Boolean | Tutor spricht |
| Outfit-Slots | Number | `hat`, `glasses`, `top`, `background` (Varianten-Index) |

## Einsetzen
1. `apps/mobile/assets/avatars/<id>/manifest.json` und `<id>.riv` ablegen.
2. In `src/avatar/registry.ts`: Manifest importieren, `riv: require("../../assets/avatars/<id>/<id>.riv")` setzen, `ACTIVE_AVATAR = "<id>"`.
3. Dev Build nötig (Rive ist ein natives Nitro-Modul, `@rive-app/react-native`). Ohne Dev Build und ohne `.riv` rendert der **2D-Platzhalter** (`PlaceholderAvatar`) mit identischem Input-Vertrag.
4. `validateManifest()` prüft das Manifest zur Laufzeit; der Test `tests/logic.test.ts` prüft es gegen das JSON-Schema.

Status: **Es existiert noch keine `.riv`-Datei.** Der Rive-Pfad ist gegen die Typen von `@rive-app/react-native` 0.5.0 geschrieben (`setNumberInputValue`/`setBooleanInputValue`), aber **[UNVERIFIZIERT] gegen echte Hardware**, bis der Avatar geliefert wird.

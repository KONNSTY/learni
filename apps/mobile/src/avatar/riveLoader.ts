/** Native: Rive-Modul laden (optional; ohne Dev Build null). */
export function loadRive(): typeof import("@rive-app/react-native") | null {
  try { return require("@rive-app/react-native"); } catch { return null; }
}

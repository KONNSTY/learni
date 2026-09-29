// packages/tokens/tokens.json -> src/theme/tokens.generated.ts (Quelle der Wahrheit, gleiche Werte wie in Figma).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/tokens/tokens.json");
const out = resolve(here, "../src/theme/tokens.generated.ts");
const tokens = JSON.parse(readFileSync(src, "utf8"));
const body = `// AUTO-GENERIERT aus packages/tokens/tokens.json (npm run tokens). Nicht von Hand aendern.\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const;\n`;
if (process.argv.includes("--check")) {
  let cur = "";
  try { cur = readFileSync(out, "utf8"); } catch {}
  if (cur !== body) { console.error("tokens.generated.ts ist veraltet: npm run tokens"); process.exit(1); }
} else writeFileSync(out, body);

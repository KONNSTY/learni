// Erzeugt TypeScript-Typen aus openapi.yaml und den JSON-Schemas.
// Ziel: packages/contracts/generated/* und apps/mobile/src/contracts/generated/* (committed, damit Expo ohne Build-Schritt laeuft).
// `--check` bricht ab, wenn die committeten Dateien veraltet sind (CI).
import { compile } from "json-schema-to-typescript";
import openapiTS, { astToString } from "openapi-typescript";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const targets = [join(root, "generated"), join(root, "../../apps/mobile/src/contracts/generated")];
const banner = "// AUTO-GENERIERT aus packages/contracts (npm run gen). Nicht von Hand aendern.\n";

const files = {};
const ast = await openapiTS(pathToFileURL(join(root, "openapi.yaml")));
files["api.d.ts"] = banner + astToString(ast);

let schemasOut = banner;
for (const f of readdirSync(join(root, "schemas")).filter((x) => x.endsWith(".schema.json")).sort()) {
  const schema = JSON.parse(readFileSync(join(root, "schemas", f), "utf8"));
  schemasOut += await compile(schema, schema.title ?? f, { bannerComment: "", additionalProperties: false, maxItems: -1, cwd: join(root, "schemas") });
}
files["schemas.d.ts"] = schemasOut;

let stale = false;
for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    if (check) {
      if (!existsSync(p) || readFileSync(p, "utf8") !== content) { console.error("veraltet:", p); stale = true; }
    } else writeFileSync(p, content);
  }
}
if (check && stale) process.exit(1);
console.log(check ? "Vertraege aktuell" : "Typen generiert");

import Ajv2020 from "ajv/dist/2020";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "../../../packages/contracts/schemas");
export const loadSchema = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const exercise = ajv.compile(loadSchema("exercise.schema.json"));
const events = ajv.compile(loadSchema("events.schema.json"));
export function assertExercise(x: unknown) { if (!exercise(x)) throw new Error("exercise invalid: " + JSON.stringify(exercise.errors)); }
export function assertEvents(xs: unknown[]) { for (const e of xs) if (!events(e)) throw new Error("event invalid: " + JSON.stringify(events.errors) + " " + JSON.stringify(e)); }

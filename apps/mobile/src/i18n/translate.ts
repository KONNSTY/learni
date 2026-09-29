import { de } from "./de";
import { en } from "./en";

export type Locale = "de" | "en";
export type MessageKey = keyof typeof de;
const tables: Record<Locale, Record<MessageKey, string>> = { de, en } as Record<Locale, Record<MessageKey, string>>;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = tables[locale][key] ?? tables.en[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : raw;
}


import * as Localization from "expo-localization";
import React, { createContext, useContext, useMemo, useState } from "react";
import { translate, type Locale, type MessageKey } from "./translate";

export type { Locale, MessageKey } from "./translate";
export function detectLocale(): Locale {
  const code = Localization.getLocales?.()[0]?.languageCode ?? "en";
  return code === "de" ? "de" : "en";
}

interface Ctx { locale: Locale; setLocale: (l: Locale) => void; t: (k: MessageKey, v?: Record<string, string | number>) => string }
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children, initial }: { children: React.ReactNode; initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial ?? detectLocale());
  const value = useMemo<Ctx>(() => ({ locale, setLocale, t: (k, v) => translate(locale, k, v) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}

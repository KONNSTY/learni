export type Gate = "login" | "ai" | "language" | "age" | "consent" | "onboarding" | "plan" | "main";

/** Reihenfolge der Pflichtschritte (rein, getestet): Login -> KI-Hinweis -> Sprache -> Alter -> Einwilligung -> Onboarding -> Plan -> Haupt. */
export function gateFor(s: { signedIn: boolean; aiNoticeAck: boolean; language: string | null; ageKnown: boolean; consentDone: boolean; plan: unknown; onboarded: boolean }): Gate {
  if (!s.signedIn) return "login";
  if (!s.aiNoticeAck) return "ai";
  if (!s.language) return "language";
  if (!s.ageKnown) return "age";
  if (!s.consentDone) return "consent";
  if (!s.onboarded) return s.plan ? "plan" : "onboarding";
  return "main";
}


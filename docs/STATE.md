# STATE (Loop-Gedächtnis)

**Aktuelle Phase:** 8 abgeschlossen (Abnahme bestanden, soweit ohne Keys/Geräte möglich). Nächster Schritt: Keys eintragen → `scripts/smoketest_providers.py`, Gerätetest, Content-Review.

## Phasenberichte
| Phase | Ergebnis |
|---|---|
| 1 Figma | Datei `tKQ47NKfbESKwNgBt8kVPy`: Tokens (Light/Dark/Motion getrennte Collections wegen Starter-Plan), 5 Komponenten-Sets, 35 Screens, klickbarer Prototyp, Sound-/Motion-Tabellen. `docs/DESIGN.md` |
| 2 Frontend | Expo/TS, alle Screens, Renderer-Registry (8 Typen), Event-Bus, Feedback (SFX/Haptik/Motion), Avatar-Platzhalter + Rive-Anbindung, lokaler Mock-Modus. iOS- und Web-Bundle bauen, Browser-E2E grün |
| 3 Backend | FastAPI + Supabase-Schema mit RLS (echtes Postgres getestet), Orchestrator, FSRS, Herzen/Streak/XP, Budgets, Konto-Löschung, Export, Webhooks |
| 4 Voice/KI | Provider-Interfaces + Adapter + Mocks, Voice-Pipeline mit Latenzmessung/Barge-in, Guardrails, Prompt-Bibliothek, Bake-off-Tooling, TTS-Cache/Prerender |
| 5 Monetarisierung | RevenueCat-/AdMob-Wrapper mit Mock, Paywall-Trigger, `SETUP_ANLEITUNG.md`, `README.md` |
| 6 Security | `SECURITY_AUDIT.md`, gitleaks sauber, pip-audit sauber, RLS-Tests |
| 7 QA | pytest 178, vitest 48, E2E (`flow`, `edge`), `QA_TESTPLAN.md`, `BUGS.md` (13 behoben, 0 offen kritisch/hoch), `KEY_SMOKETEST.md`, `RELEASE_IOS.md` |
| 8 Abnahme | `ABNAHME.md` mit Status je Anforderung und Liste „Wartet auf Keys oder Entscheidung“ |

## Offen (siehe ABNAHME.md, „Wartet auf Keys oder Entscheidung“)
Spec-Dokument, Keys/Konten, Native-Speaker-Review/Content B1–B2, Avatar-Paket, Gerätetest, echte Viseme-Zeitstempel/Streaming, Login-Härtung, Recht, Android.

## Bekannte Bugs
Keine offenen kritischen/hohen (siehe BUGS.md).

## Blocker
Keine harten Blocker; Spec fehlte (Defaults/Annahmen dokumentiert).

# QA-Testplan

Stand: ohne API-Keys, KI nur im **Mock-Modus**. Automatisierte Abdeckung: `apps/api/tests` (pytest, inkl. echtem PostgreSQL für RLS), `apps/mobile/tests` (vitest), `apps/mobile/e2e` (Playwright gegen Expo-Web-Export im Browser). Manuelle Matrix für das Gerät unten.

## 1. Automatisierte Tests
| Bereich | Datei(en) | Inhalt |
|---|---|---|
| FSRS, Herzen, Streak, XP, Level, Trophäen | `apps/api/tests/test_engine.py` | reine Logik, Grenzfälle |
| Orchestrator, Curriculum, Auswertung | `test_misc.py` | deterministisch, alle Übungstypen schema-valide, Herz-Regeln je Typ |
| Budget, Kill-Switch, Geo-Tiering, Fair-Use | `test_misc.py` | Tages-Reset, Global-Kill-Switch, Pro-Fair-Use |
| API, Auth (Supabase-JWT), IDOR, Webhooks | `test_api.py` | Registrieren → Onboarding → Lektion → Export → Löschen, Replay-Schutz, RevenueCat |
| Voice-Pipeline | `test_voice.py`, `test_voice_units.py` | Mock-STT/LLM/TTS, Viseme 0–21, Halluzinationsfilter, Barge-in, **Audio nie persistiert** |
| Provider-Adapter | `test_providers.py` | Requests gegen `httpx.MockTransport` (Groq, ElevenLabs, Azure, Piper, LiteLLM-Failover) |
| Guardrails, Prompt-Injection | `test_guardrails.py`, `test_voice.py` | Schema, Leak-Erkennung, Injection-/Topic-/Moderations-Muster |
| Sicherheit | `test_security.py` | keine Keys in Logs/Fehlern, generische 500, Auth auf allen Routen, Isolation, XP-Farming |
| **RLS (echtes Postgres)** | `test_rls.py` | Nutzer A sieht/ändert nie Daten von B, Backend-only-Tabellen gesperrt, Cascade bei Konto-Löschung |
| Verträge | `test_misc.py`, `apps/mobile/tests/events.test.ts` | OpenAPI ↔ Routen, Event-Schema ↔ Frontend-Events, Avatar-Manifest |
| Mobile-Logik | `apps/mobile/tests/*.test.ts` | Herzen, VAD, Visemes, Event-Bus, Feedback-Map (Sound/Haptik/Motion), i18n-Parität, Kontrast, Token-Sync, HTTP-Client, Gate-Reihenfolge, Paywall-Cooldown, Werbe-Regeln, Secure-Storage-Chunking |
| Mock-API (Expo Go ohne Backend) | `localApi.test.ts` | kompletter Durchlauf, alle Formate, Herzen/Pro/Streak/Consent, Contract-Validierung per Ajv |
| **E2E im Browser** | `apps/mobile/e2e/flow.mjs`, `edge.mjs` | Login → Onboarding → 8 Übungen → Lektionsende → Celebration → Profil → Konto löschen; Herzen leer → Sheet → Rewarded Ad; Sprachwechsel; Pro; Englisch + Dark; Reduce Motion + 320 px |

Ausführen: siehe `README.md`. E2E: `cd apps/mobile && npx expo export --platform web --output-dir /tmp/learni-web && (cd /tmp/learni-web && python3 -m http.server 8098 &) && BASE_URL=http://localhost:8098 node e2e/flow.mjs && BASE_URL=http://localhost:8098 node e2e/edge.mjs`.

## 2. Manuelle Testmatrix (iPhone, Expo Go bzw. Dev Client)
Legende: ☐ offen · Ergebnisse als ✔/✘ mit Bug-ID in `docs/BUGS.md` eintragen.

### Screens
| Screen | Prüfen | ☐ |
|---|---|---|
| Loading | Splash ≤ 1 s, kein Flackern | ☐ |
| Login | Apple/Google/E-Mail; Fehler bei Abbruch; Testmodus-Hinweis ohne Supabase | ☐ |
| KI-Hinweis | erscheint vor Sprachwahl, Text DE/EN | ☐ |
| Sprachauswahl | Suche (Akzente egal), Zoom 1×/2×/3×, kein Flaggen-Symbol, Beta-Label bei Tier B | ☐ |
| Altersgate / Consent | unter 16 → personalisierte Werbung nicht aktivierbar; ATT-Hinweis (iOS) | ☐ |
| Onboarding | 60–90 s; Anfänger überspringen Testfragen; falsche Antwort beendet Fragen | ☐ |
| Lernplan/Trial | Preise aus Remote Config, Trial-Button, „Mit Free starten“ | ☐ |
| Hauptscreen | Layout exakt: Speaker links, Profil rechts, Avatar+Badge, Untertitel+Toggle, Antworten, Mic/Wiederholen/Langsamer, Herzen/Ziel/Streak | ☐ |
| Profil/Settings | getrennte Schalter Stimme/SFX/Haptik wirken sofort und unabhängig | ☐ |
| Paywall (5 Trigger) | `hearts_empty` (Sheet + Rewarded), `ai_minutes_exhausted`, `pro_feature`, `streak_at_risk`, `onboarding_plan` | ☐ |
| Aussprache-Report | nach Sprechübung, kein Herzverlust | ☐ |
| Lektionsende / Streak / Level-Up | Konfetti, Sound, Haptik stark | ☐ |
| Konto löschen | danach Login-Screen, Daten weg (Export leer) | ☐ |
| KI-Profil | anzeigen und löschen | ☐ |

### Übungsformate (je Zustand: default, gewählt, richtig, falsch, deaktiviert)
`multiple_choice` ☐ · `matching` ☐ · `fill_blank` ☐ · `listen_pick` (Audio) ☐ · `speak_repeat` ☐ · `word_order` ☐ · `roleplay` (Pro) ☐ · `flashcard` ☐

### Querschnitt
| Fall | Erwartung | ☐ |
|---|---|---|
| Offline (Flugmodus) | Banner „offline“, kein Absturz, Retry-Button | ☐ |
| Mikrofon verweigert | Tipp-Alternative bei Sprechübungen, Hinweis + Einstellungen | ☐ |
| Anruf/Siri während Aufnahme | Aufnahme stoppt sauber, kein Hänger | ☐ |
| App im Hintergrund/zurück | Zustand bleibt, kein Audio im Hintergrund | ☐ |
| Dark Mode (System + manuell) | Kontrast ok, keine weißen Flächen | ☐ |
| Reduce Motion | keine Bewegung (Konfetti, Shake, Pop), Farb-/Textwechsel bleiben | ☐ |
| Stummschalter | keine SFX/Avatar-Stimme, Haptik bleibt (separat abschaltbar) | ☐ |
| iPhone SE (klein) / Pro Max (groß) | kein Abschneiden, alles erreichbar, Dynamic Type bis 140 % | ☐ |
| Deutsch / Englisch | alle Texte, Zahlen-/Währungsformat, System-Locale wird erkannt | ☐ |
| Tutor-Sprache Barge-in | Mic drücken stoppt Tutor-Audio und Avatar sofort | ☐ |
| Push-to-talk vs. Auto-VAD | Auto-VAD stoppt nach ~0,8 s Stille | ☐ |
| Werbung | nie im Sprechfluss/Lektion; Rewarded freiwillig; Pro ohne Werbung | ☐ |
| Sprach-Tests mit Mocks | Mikrofonaufnahme, VAD, Platzhalter-STT, lokaler TTS (expo-speech), Viseme-Animation am Platzhalter-Avatar | ☐ |

Die Punkte dieser Tabelle, die nur auf einem echten Gerät prüfbar sind (Mikrofon, Haptik, Stummschalter, Anrufe, Store-Abläufe), sind in `docs/ABNAHME.md` als „wartet auf Gerätetest“ geführt.

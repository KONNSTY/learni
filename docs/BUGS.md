# Bugliste

Schwere: **kritisch** (Absturz/Datenverlust/Sicherheit), **hoch** (Kernfunktion kaputt), **mittel**, **niedrig**.

| ID | Schwere | Schritte | Erwartet | Tatsächlich | Status |
|---|---|---|---|---|---|
| B-001 | hoch | Mock-LLM-Turn ohne `expected_answer` an Guardrail | Antwort wird akzeptiert | Schema-Verletzung → stiller Fallback-Text statt Mock-Dialog (`providers/mock.py` entfernte `None`-Felder) | behoben, Regressionstest `test_mock_llm_turns_pass_the_real_guardrail_schema` |
| B-002 | mittel | Onboarding „Anfänger“ + 2 richtige Testfragen | Level A1 | Level A2 (Selbsteinschätzung wurde überstimmt) | behoben (`curriculum.placement_level`), Test `test_full_flow…` |
| B-003 | mittel | Übungsschema, Übung ohne Übersetzung | Schema akzeptiert `translation: null` | Schema erlaubte nur String | behoben (`exercise.schema.json`) |
| B-004 | hoch | Grammatik-Übungen (Lückentext) | erscheinen im Curriculum | nie ausgewählt (Items ohne Skill `grammar`) | behoben (`orchestrator.pick_skill`), Test `test_every_exercise_type…` |
| B-005 | hoch | Sprechübung: Audio an `/v1/voice/turn` | Aussprache-Bewertung ohne Tutor-Antwort | Tutor-Turn (LLM+TTS) lief zusätzlich, unnötige Kosten | behoben (Referenztext → nur STT+Aussprache) |
| B-006 | hoch | Web/Expo: `react-native-google-mobile-ads`, Rive, RevenueCat statisch importiert | App startet | Metro-Fehler „native-only module“ | behoben (`*.web.ts`-Varianten, dynamische Requires) |
| B-007 | hoch | Web-Vorschau: SecureStore | Login/Boot funktioniert | `getValueWithKeyAsync is not a function` | behoben (Web-Backend nur für Vorschau) |
| B-008 | hoch | Sprechen zeigt Paywall „Herzen leer“ | Sheet erscheint | blockiert, wenn TTS-Ende-Callback ausbleibt (`speaking` blieb wahr) | behoben (`state/speaking.ts` mit Ablauf), Test `speaking flag expiry` |
| B-009 | mittel | Kurzer Tipp auf Mikrofon | Hinweis „Halten zum Sprechen“ | keine Reaktion | behoben (`onTap`-Hinweis) |
| B-010 | mittel | Hauptscreen: untere Steuerung überlappt Inhalt | Inhalt scrollt oberhalb der Steuerung | Mic-Button überdeckte Button (ScrollView ohne `flex:1`) | behoben |
| B-011 | niedrig | Lektionsende, Minuten | „1,2 Min“ (DE) | „1.2 Min“ | behoben (`formatNumber`) |
| B-012 | niedrig | Sprachauswahl, Beta-Chip in Spalte | Chip bleibt kompakt | Chip zog sich über die Kartenbreite | behoben |
| B-013 | mittel | Jede Anfrage mit ungültigem Token, ohne Supabase-Config | 401 | 503 „auth not configured“ (Konfigurationsleck) | behoben, Test `test_auth_required_and_invalid` |

Offene kritische/hohe Fehler: **keine**.

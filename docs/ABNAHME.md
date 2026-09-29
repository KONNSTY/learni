# Projektabnahme

**Wichtiger Hinweis:** Das „Planungsdokument: KI-Sprachtutor-App“ (Spec) lag der Umsetzung **nicht** vor (siehe `docs/DECISIONS.md`). Die Checkliste folgt daher den Spec-Regeln aus dem Master-Prompt (dort als Spec-Abschnitte 2–8 referenziert). Die Nummerierung der Unterabschnitte ist **[ANNAHME]**; sobald die Spec vorliegt, ist diese Tabelle abzugleichen. Statuswerte: `erfüllt`, `teilweise`, `offen`; Verweise auf Datei oder Test.

## Spec 2 – Die sechs Korrekturen [ANNAHME: aus den „nicht verhandelbaren Regeln“ abgeleitet]
| # | Korrektur | Status | Nachweis |
|---|---|---|---|
| 1 | Herzen nur für entscheidbare Formate, **Sprechfehler kosten keine Herzen** | erfüllt | `engine/hearts.py`; `test_engine.py::test_hearts_decidable_costs_speaking_never`; `test_api.py::test_speak_repeat…`; Mobile `logic/hearts.ts` + `tests/logic.test.ts` |
| 2 | Free: KI-Minuten-Budget **und** hartes Cent-Budget/Nutzer/Tag mit Kill-Switch und Fallback auf gecachten Content | erfüllt | `engine/budget.py`, `test_misc.py` (Budgets, Geo, globaler Kill-Switch), `test_voice.py::test_budget_exhausted_falls_back…` |
| 3 | Lernsprache wählt der Nutzer und geht als Sprach-Hint an STT; erkannt wird nur die Muttersprache | erfüllt | `providers/stt.py` (`language`), `test_providers.py::test_groq_stt_request_has_language_hint…`, Sprachauswahl `LanguageSelectScreen`, Muttersprache aus Geräte-Locale (`i18n.detectLocale`) |
| 4 | Keine Länderflaggen als alleiniges Sprachsymbol | erfüllt | `LanguageBadge` (Kürzel + Name, Regionsvariante), `content/languages.json`, Test `test_languages_use_badges_not_flags`, Figma-Screen 03 |
| 5 | Werbung: **AdMob mit Mediation** (nicht AdSense), UMP/TCF, ATT, nie im Sprechfluss, Rewarded freiwillig | teilweise | `ads/index.ts`, `ads/policy.ts` (+Tests). Mediation-Adapter und echte UMP-Nachricht: **wartet auf AdMob-Konto** |
| 6 | Lern-Engine steuert deterministisch, LLM nur Gespräch (strukturiertes JSON) | erfüllt | `engine/orchestrator.py` (+Determinismus-Test), `guardrails.validate_llm_turn`, `schemas/llm_turn.schema.json` |

## Spec 3 – Produkt und Lernlogik
| Anforderung | Status | Nachweis |
|---|---|---|
| FSRS, Lernermodell je Nutzer und Sprache (Item-Gedächtnis + Skills Hören/Sprechen/Vokabeln/Grammatik getrennt) | erfüllt | `engine/fsrs.py`, `service.answer`, Tabellen `item_states`, `learner_state.skills`; `test_engine.py` |
| Curriculum-Graph CEFR A1–B2, Themen, Wortschatz nach Frequenz, Grammatikpunkte | teilweise | `engine/curriculum.py`, `content/packs`. Struktur vollständig, **Inhalt nur Seed** (es: A1+A2-Beispiel, andere: 10 Basiswörter), keine B1/B2-Packs → Content-Erstellung offen |
| Hybrid-Content: A1–A2 vorab, gecachtes TTS-Audio über CDN, Live-LLM für Gespräche/Rollenspiele | erfüllt | `scripts/prerender_audio.py`, `voice/tts_cache.py`, `app.py` (audio_url aus Cache), `voice/pipeline.py` |
| Übungsformate (Spec 3.4 [ANNAHME]: 8 Typen) als Komponenten mit Zuständen | erfüllt | `apps/mobile/src/exercises/*`, `OptionCard` (default/gewählt/richtig/falsch/deaktiviert), Figma 30–39 |
| Sprachpaar-Matrix: Inhalt zielsprachenzentriert, Erklärungen in UI-Sprache erzeugt und gecacht | erfüllt (Mechanik) / wartet auf Keys (echte Erklärungsqualität) | Items tragen `translations.de/en`; `POST /v1/explain` mit Cache-Tabelle `explanations` (Migration 0003), Mock-Antworten werden nie gespeichert; Tests `test_explain_*`, Button „Erklärung“ im Hauptscreen |
| Onboarding im Gespräch (Selbsteinschätzung + 2–3 adaptive Fragen, Ziel, Tagesziel) | erfüllt | `OnboardingScreen`, `onboarding/questions.ts`, `curriculum.placement_level`, E2E `flow.mjs` |
| Herzen-Regeneration/Reset, Streak inkl. Freeze, Tagesziele, XP, Level-Ups, Trophäen | erfüllt | `engine/*`, `service.py`, `test_engine.py`, `test_api.py` |
| Ligen und Freunde als Datenmodell | erfüllt | Tabellen `league_entries`, `friendships` (+RLS-Tests), `engine/gamification.py` (Dataclasses) |
| Content-Review-Status draft/reviewed/published, nur reviewed/published an Nutzer | erfüllt | `content.py`, `scripts/import_content.py`, `test_misc.py::test_content_status_gate`, Testmodus-Label im Client |

## Spec 4 – Monetarisierung
| Anforderung | Status | Nachweis |
|---|---|---|
| Free/Pro-Tabelle (4.1 [ANNAHME]) als Konfiguration | erfüllt | `remote_config.json`, `GET /v1/config` |
| Paywall-Trigger (4.2 [ANNAHME]): Herzen leer, KI-Minuten, Pro-Feature (Rollenspiel), Streak in Gefahr, Onboarding-Plan | erfüllt | Backend `paywall.py`, `service._streak_risk_events` (Serie ≥ 3, gestern aktiv, heute kein XP, nach 17 Uhr UTC, Free ohne Freeze; Test `test_streak_at_risk_trigger…`), Client `paywall/triggers.ts` mit Cooldown und Aufschub während der Tutor spricht, Screens (Figma 12–16). Die Tageszeit ist UTC-basiert (**[ANNAHME]**, lokale Zeit folgt mit Zeitzonen-Angabe) |
| RevenueCat (Entitlement `pro`, Webhook → Supabase), Sandbox-Mock ohne Keys | erfüllt (Mock) / wartet auf Keys (echt) | `purchases/index.ts`, `POST /v1/webhooks/revenuecat`, `test_api.py` (Kauf, Ablauf, KPI-Events, Geo) |
| Preise/Trial nur Konfiguration, A/B-testbar | erfüllt | `remote_config.json` (`pricing`, `experiment_variants`) |
| Rewarded Ad (freiwillig) → Herz, Tageslimit 3, nur Free | erfüllt | `service.rewarded_ad`, `test_api.py::test_rewarded_ad…` |

## Spec 5 – KI, Voice, Kosten
| Anforderung | Status | Nachweis |
|---|---|---|
| Provider-Abstraktion LLM/STT/TTS/Aussprache per Config, Mock ohne Keys | erfüllt | `providers/*`, `factory.py`, `test_providers.py` |
| LLM-Gateway (LiteLLM/OpenRouter) mit Failover, Modelle nur Konfiguration | erfüllt (Adapter) / wartet auf Keys | `providers/llm_gateway.py` (Failover-Test) |
| STT Groq Whisper v3 Turbo + Scribe (Upgrade), VAD, Sprach-Hint, Wort-Timestamps, Halluzinationsfilter | erfüllt (Adapter) / wartet auf Keys | `providers/stt.py`, `voice/pipeline.py::hallucination_filter`, Client-VAD `logic/vad.ts` |
| TTS Azure (Visemes), ElevenLabs Premium, Open-Source-Adapter (Piper) | teilweise | Adapter vorhanden. **Azure-REST liefert keine Viseme-Zeitstempel → Heuristik**; echte `VisemeReceived` per Speech-SDK offen. Lücken hr/id bei Piper dokumentiert (`docs/TTS_OPEN_SOURCE.md`) |
| Aussprachebewertung (Azure), Locale-Abdeckung prüfen | wartet auf Keys | `providers/pronunciation.py`, `scripts/smoketest_providers.py` |
| Voice-Pipeline: Ziel 1,2–1,6 s, Alarm > 2 s, Stufen-Latenz p50/p95, Barge-in, Push-to-talk und Auto-VAD | teilweise | Messung/Alarm/Barge-in implementiert und getestet (`voice/pipeline.py`, Client `MainScreen`). **Reale Latenz unmessbar ohne Keys**; TTS läuft satzweise parallel statt echtem Token-Streaming (REST-Turn statt WebSocket) |
| Prompt-Bibliothek im Repo (Level, Korrekturstil, Rollenspiele, Injection-Schutz) | erfüllt | `content/prompts`, `content/scenarios`, `prompts.py`, `test_guardrails.py` |
| Guardrails: Whitelist, Schema, Moderation, Injection, Topic-Guard, Token-Caps | erfüllt | `guardrails.py`, Tests |
| Kostenkontrolle: Cent-Budget, Geo-Tiering, Rate-Limits, Token-Caps, Fair-Use Pro (45 min), Kill-Switch | erfüllt | `engine/budget.py`, `security.py`, Geo-Test `test_geo_tiering…` |
| Quality-Bake-off-Tooling (30–50 Dialoge/Sprache, Bewertungstabelle) | erfüllt (Tooling) / wartet auf Keys | `scripts/bakeoff.py` |
| Mock-Modus: deterministischer Test-Tutor, lokaler TTS | erfüllt | `providers/mock.py`, `expo-speech` im Client |

## Spec 6 – Architekturregeln (alle acht)
| # | Regel | Status | Nachweis im Code |
|---|---|---|---|
| 1 | Contract-first: versionierte OpenAPI + Events, generierte Typen | erfüllt | `packages/contracts/openapi.yaml`, `schemas/*.json`, `npm run gen/check`, Test „OpenAPI ↔ Routen“ |
| 2 | Semantische Events statt UI-Anweisungen | erfüllt | `events.py`, `events.schema.json` (Test: keine UI-Begriffe), `feedback/feedbackMap.ts` |
| 3 | Exercise-Schema + Renderer-Registry | erfüllt | `exercise.schema.json`, `exercises/registry.ts` (`Record<ExerciseType,…>`) |
| 4 | Avatar-Interface (.riv + manifest.json, Visemes 0–21, Emotionen, Blick, Outfit) | teilweise | Schema, Manifest, Platzhalter-Avatar, Rive-Anbindung, Viseme-Mapping (`avatar/*`); **kein echtes `.riv`**, Rive-Pfad ungetestet auf Gerät |
| 5 | Theme und Design-Tokens in Theme-Dateien | erfüllt | `packages/tokens/tokens.json` → `theme/`, Test Token-Sync |
| 6 | Provider-Abstraktion, LLM über Gateway mit Failover | erfüllt | s. Spec 5 |
| 7 | Content-Trennung, Feature-Flags, Remote Config | erfüllt | `content/`, `remote_config.json`, `FLAG_*` |
| 8 | Stack: React Native + Expo (TS, Reanimated, Rive), FastAPI, Supabase, Redis | erfüllt | `apps/*`; Redis-Rate-Limiter (`RedisRateLimiter`, **[UNVERIFIZIERT] gegen echten Redis**); Budgets/Zähler in Postgres |

## Spec 7 – UX, Design, Motion, Sound, Haptik
| Anforderung | Status | Nachweis |
|---|---|---|
| Figma: alle Screens/Zustände, Prototyp klickbar, Tokens, Design-System (Light/Dark/Reduce-Motion) | erfüllt | `docs/DESIGN.md` (35 Screens, Komponenten-Sets, Variablen; Starter-Plan-Einschränkungen dokumentiert) |
| Hauptscreen exakt nach Vorgabe | erfüllt | `MainScreen.tsx`, Figma 09/10, E2E-Screenshots |
| Animationen: Button-Pop, Herzen-Puls/-Bruch, Konfetti, XP-Zähler, Avatar-Reaktionen | erfüllt (Web-E2E) / wartet auf Gerätetest | `Button`, `StatBar`, `Confetti`, `AnimatedStat`, Avatar-Emotion; Reduce Motion: Dauer 0/kein Konfetti (E2E `REDUCE`) |
| Echte SFX für alle Ereignisse, < 100–200 ms, CC0 mit Lizenzdatei | erfüllt (Assets, Vorladen) / wartet auf Gerätetest (Latenz) | `assets/sfx/*.wav`, `LICENSES.md`, `feedback/sfx.ts` |
| Haptik je Ereignis (leicht/weich/mittel/stark) | erfüllt (Logik getestet) / wartet auf Gerätetest | `feedback/feedbackMap.ts`, `haptics.ts` |
| Systemstummschalter, getrennte Toggles Stimme/SFX/Haptik | erfüllt | `sfx.ts` (`playsInSilentMode:false`), `ProfileScreen`, `applyPrefs`-Tests |
| Läuft in Expo Go / Dev Client, Mock-Fallbacks für native Module | erfüllt (Bundle + Web-E2E) / wartet auf Gerätetest | `npx expo export --platform ios` grün, `*.web.ts`, dynamische Requires |
| Design-zu-Code, Code-Connect | teilweise | Tokens exportiert (`gen-tokens`), Mapping-Tabelle `apps/mobile/figma.code-connect.md`; echtes Code Connect braucht Dev-Mode-Plan |

## Spec 8 – Recht, Compliance, KPIs
| Anforderung | Status | Nachweis |
|---|---|---|
| Audio wird nicht gespeichert | erfüllt | `test_audio_is_never_persisted`, Client löscht Datei sofort |
| DSGVO: EU-Regionen, Einwilligung, Löschkonzept, Export | erfüllt (Code) / teilweise (Betrieb) | Consent-Screen, `DELETE /v1/account`, `GET /v1/export`; **EU-Region/AVV bei Anbietern wartet auf Entscheidung** (`LEGAL_TODO.md`) |
| Altersgate, kein personalisiertes Ad-Targeting für Minderjährige | erfüllt | `AgeGateScreen`, `ads/policy.ts`, Backend `patch_profile` (Tests) |
| EU AI Act: sichtbarer KI-Hinweis, keine Emotionserkennung aus Nutzerdaten | erfüllt | `AiNoticeScreen`, Hinweis im Hauptscreen/Settings, KI-Profil nur aus Lernverhalten |
| Stores: Sign in with Apple, Konto-Löschung in der App, Abo-Regeln, Werbekennzeichnung | teilweise | Apple/Google-Login-Code, Löschscreen, Paywall-Rechtstexte; **echte Store-Abläufe wartet auf Apple/Google-Konten** |
| `docs/LEGAL_TODO.md` | erfüllt | Datei |
| KPI-Tracking: D1/D7/D30, Trial-Start, Trial→Paid, COGS/DAU, Ad-ARPDAU, Latenz p95, Fehlerrate/Sprache | erfüllt (Erfassung + Auswertung) | `analytics_events` (Client-Events + serverseitige Kauf-Events), `kpi.py` + Test; Ad-Umsatz je Impression **wartet auf AdMob-Reporting** |

## Sicherheit, QA (Phasen 6/7)
| Anforderung | Status | Nachweis |
|---|---|---|
| Keine offenen kritischen/hohen Funde, Secret-Scan sauber | erfüllt | `docs/SECURITY_AUDIT.md` |
| RLS-Tests (A sieht nie B) | erfüllt | `test_rls.py` (echtes PostgreSQL) |
| Tests grün, Bugliste ohne kritische/hohe Einträge | erfüllt | `docs/BUGS.md`; pytest 179, vitest 48, E2E `flow.mjs`/`edge.mjs`, Bundle-Export iOS+Web |
| Key-Smoketest vorbereitet | erfüllt | `docs/KEY_SMOKETEST.md`, `scripts/smoketest_providers.py` |
| Release-Doku iOS (TestFlight später) | erfüllt | `docs/RELEASE_IOS.md` |

---

## Wartet auf Keys oder Entscheidung
1. **Spec-Dokument** bereitstellen → Abgleich dieser Tabelle (insb. Abschnitt 2, 3.4, 4.1, 4.2, 7).
2. **API-Keys/Konten:** Supabase, LLM-Gateway + Modell-Host, Groq, Azure, (ElevenLabs), RevenueCat + App-Store-Produkte, AdMob + UMP-Nachricht, Apple Developer, Google OAuth – Anleitung `docs/SETUP_ANLEITUNG.md`, danach `scripts/smoketest_providers.py`.
3. **Native-Speaker-Review und Content-Erstellung** (alle Packs stehen auf `draft`; B1/B2 fehlen) und **Bake-off** je Sprache mit echten Modellen.
4. **Avatar-Paket** (`.riv` + `manifest.json`) liefern; Rive-Pfad danach auf dem Gerät prüfen (`docs/AVATAR_PACKAGE.md`).
5. **Gerätetest auf dem iPhone** (Mikrofon, Haptik, Stummschalter, Anrufe/Unterbrechungen, SFX-Latenz, Animationen) laut `docs/QA_TESTPLAN.md`.
6. **Echte Viseme-Zeitstempel** (Azure Speech SDK statt REST) und **Token-Streaming** (WebSocket) nachziehen, sobald Latenz mit echten Providern gemessen ist.
7. Login-Härtung (S-08) vor dem Launch aktivieren; lokale Erinnerungs-Benachrichtigung für gefährdete Serien und Nutzer-Zeitzone für den `streak_at_risk`-Zeitpunkt ergänzen.
8. **Rechtliche Prüfung** (`docs/LEGAL_TODO.md`), Bundle-ID/Store-Konten, Preisstrategie und Geo-Tiers bestätigen.
9. **Android** bauen und testen (vorbereitet, nicht getestet).

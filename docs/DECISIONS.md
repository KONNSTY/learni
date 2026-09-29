# Entscheidungen und Annahmen

Format: `[ANNAHME]` = eigene Entscheidung ohne Vorgabe, `[UNVERIFIZIERT]` = nicht gegen aktuelle Doku geprüft, `[KONFLIKT]` = Widerspruch Prompt/Spec.

## Defaults aus Master-Prompt, Abschnitt 2
| Entscheidung | Wert | Ablage |
|---|---|---|
| Frontend-Stack | React Native + Expo, TypeScript strikt, Reanimated, Rive | `apps/mobile` |
| UI-Sprachen | Deutsch, Englisch | `apps/mobile/src/i18n` |
| Launch-Sprachen | Englisch, Spanisch, Französisch (groß); Kroatisch, Indonesisch, Türkisch (Long-Tail). Tier A stabil, B gut, C Beta | `content/languages.json` |
| Avatar | 2D-Platzhalter, echter Avatar später als Paket (`.riv` + `manifest.json`) | `packages/contracts/schemas/avatar-manifest.schema.json` |
| Preise | 10–13 €/Monat, 60–80 €/Jahr, Trial 7 Tage – nur Konfiguration | `apps/api/learni_api/remote_config.json` |
| Content-Review | `draft` → `reviewed` → `published`; nur `reviewed`/`published` an Nutzer, `draft` nur im Testmodus mit Beta-Label | `content/packs`, `apps/api/learni_api/content.py` |

## Getroffene Annahmen
- **[ANNAHME] Spec-Datei fehlt.** Das „Planungsdokument: KI-Sprachtutor-App“ (Stand 29.09.2026) lag der Sitzung nicht bei. Alle Spec-Regeln stammen aus dem Master-Prompt (Abschnitt 3) und werden daraus abgeleitet. Die Tabellen aus Spec 3.4 (Übungsformate), 4.1 (Free/Pro), 4.2 (Paywall-Trigger) und 7 (Haptik/Sound/Motion) sind rekonstruiert (siehe unten). Sobald die Spec vorliegt: Abgleich in `docs/ABNAHME.md`.
- **[ANNAHME] Übungsformate (Spec 3.4):** Auswahl (`multiple_choice`), Zuordnung (`matching`), Lückentext (`fill_blank`), Hörverstehen (`listen_pick`), Sprechen (`speak_repeat`), Wörter ordnen (`word_order`), Rollenspiel (`roleplay`), Vokabelkarte (`flashcard`). Entscheidbar (kosten Herzen): `multiple_choice`, `matching`, `fill_blank`, `listen_pick`, `word_order`. Nicht entscheidbar (keine Herzen): `speak_repeat`, `roleplay`, `flashcard`.
- **[ANNAHME] Free/Pro (Spec 4.1):** Free: 5 Herzen (Reset alle 5 h einzeln nachladend → vereinfacht: Vollreset täglich 00:00 UTC + 1 Herz je 4 h), 10 KI-Minuten/Tag, 25 Cent Kostenbudget/Tag, Werbung (Interstitial zwischen Lektionen, nie im Sprechfluss), Rollenspiele gesperrt. Pro: unendlich Herzen, 45 Min KI/Tag (Fair-Use), keine Werbung, Rollenspiele, Streak-Freeze, erweiterte Aussprache-Auswertung. Alles in `remote_config.json`.
- **[ANNAHME] Paywall-Trigger (Spec 4.2):** `hearts_empty`, `ai_minutes_exhausted`, `pro_feature` (Rollenspiel), `streak_at_risk` (Freeze), `onboarding_plan` (Lernplan mit Trial). Umgesetzt in `apps/api/learni_api/paywall.py` und `apps/mobile/src/paywall/triggers.ts`.
- **[ANNAHME] Haptik/Sound/Motion (Spec 7):** siehe Figma-Seite „Prototype & Sound“ und `apps/mobile/src/feedback/feedbackMap.ts`.
- **[ANNAHME] Figma Starter-Plan:** nur 3 Seiten und 1 Variablen-Modus je Collection. Light/Dark und Normal/Reduce-Motion sind daher getrennte Collections (`Color Light`, `Color Dark`, `Motion Normal`, `Motion Reduce`). Seiten: `Design System`, `Screens`, `Prototype & Sound`. Der Code (`packages/tokens/tokens.json`) ist die Quelle der Wahrheit.
- **[ANNAHME] „taste“-Skill** ist in dieser Sitzung nicht verfügbar. Ersatz: Figma-`figma-use`-Skill plus eigene Designregeln (`docs/DESIGN.md`).
- **[ANNAHME] Auth im Backend:** Supabase-JWT (HS256, `SUPABASE_JWT_SECRET`) wird geprüft. Nur bei `APP_ENV=dev` ist zusätzlich `Bearer dev:<uuid>` erlaubt (lokales Testen ohne Supabase).
- **[ANNAHME] Persistenz:** Backend spricht über ein `Store`-Interface. Implementierungen: `MemoryStore` (Tests/Dev ohne Supabase) und `PostgrestStore` (Supabase, Service-Role serverseitig). SQL-Migrationen liegen in `apps/api/supabase/migrations`, RLS-Tests laufen gegen ein echtes lokales Postgres.
- **[ANNAHME] Streaming:** Der Voice-Pfad ist als REST (`/v1/voice/turn`) plus SSE-fähiger Pipeline umgesetzt; ein Audio-WebSocket ist als Erweiterung vorbereitet. Audio wird nur im Speicher verarbeitet.
- **[ANNAHME] Open-Source-TTS:** Adapter für Piper (CLI) als lokaler Dev-Fallback, Auswahlbegründung in `docs/TTS_OPEN_SOURCE.md` (Sprachabdeckung `[UNVERIFIZIERT]`, muss vor Launch gegen aktuelle Modellliste geprüft werden).
- **[ANNAHME] Modellnamen:** Gemma 4 / Qwen 3.5 stammen aus dem Prompt. Konkrete Gateway-Modell-IDs sind Konfiguration (`LLM_MODEL_*`), nicht im Code fest verdrahtet `[UNVERIFIZIERT]`.

## Weitere Entscheidungen (Umsetzung)
- **[ANNAHME] Figma-Umfang:** 35 Screens auf Seite „Screens“, 5 Komponenten-Sets, Prototyp per Smart-Animate-Navigation (Loading → Login → Sprache → Onboarding → Plan → Hauptscreen ↔ Aufnahme → Profil → Konto löschen; Paywalls, Lektionsende → Streak → Level-Up). Animationen selbst (Konfetti, Herzbruch …) sind als Tabelle „Prototype & Sound“ spezifiziert und im Code umgesetzt, nicht als Figma-Bewegung.
- **[ANNAHME] Mock-Modus im Client:** In Debug-Builds ohne `EXPO_PUBLIC_API_URL` läuft die App komplett lokal (`mock/localApi.ts`, gleiche Contract-Formate, per Ajv gegen die JSON-Schemas getestet). Release-Builds ignorieren den Mock (`resolveApiMode`).
- **[ANNAHME] Aufnahmeformat:** iOS 16-kHz-Linear-PCM-WAV, Android AAC/M4A (`audio_mime`); der Server akzeptiert beides.
- **[ANNAHME] Geo-Tiering:** Land aus Geräte-Region (Sync) bzw. Store-Land (RevenueCat-Webhook, gewinnt und sperrt); Tabelle `geo_tiers` in `remote_config.json`.
- **[ANNAHME] Tageszeit für `streak_at_risk`:** UTC (17 Uhr), bis die Nutzer-Zeitzone vorliegt.
- **[ANNAHME] Rate-Limits:** In-Memory-Token-Bucket, bei `REDIS_URL` verteiltes Fixed-Window-Limit mit lokalem Fallback bei Redis-Fehlern (fail-open, damit ein Redis-Ausfall die API nicht stoppt; Kosten schützt zusätzlich das Cent-Budget).
- **[ANNAHME] Grenzen der Vorschau:** Web-Export dient nur E2E-Tests/Vorschau (SecureStore → localStorage, Ads/Käufe/Rive als Mock); Zielplattform bleibt iOS/Android.
- **[UNVERIFIZIERT] Nicht auf echter Hardware/Anbietern geprüft:** Rive-Rendering, expo-audio-Aufnahme, Haptik, Stummschalter-Verhalten, AdMob/UMP, RevenueCat, Apple/Google-Login, alle realen Provider-Aufrufe, Redis.

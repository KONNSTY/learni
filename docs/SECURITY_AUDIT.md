# Security-Audit

Stand: nach Phase 6/7. Methode: statische Prüfung des Repos und der Git-Historie, automatisierte Regressionstests (`apps/api/tests/test_security.py`, `test_rls.py`, `test_guardrails.py`, `apps/mobile/tests/app.test.ts`), Abhängigkeits-Audits, Browser-E2E. Kein externer Penetrationstest.

**Ergebnis: keine offenen kritischen oder hohen Funde.** Offene mittlere/niedrige Punkte stehen unten mit Begründung.

## Werkzeuge / Läufe
| Prüfung | Ergebnis |
|---|---|
| `gitleaks detect` (Repo + gesamte Historie, v8.21.2) | **sauber** (ein Fund in der Historie war ein absichtlich JWT-förmiger Testwert, per `.gitleaksignore` auf genau diesen Fingerprint dokumentiert; aktueller Stand baut den Wert zur Laufzeit zusammen) |
| `pip-audit` (Laufzeit-Abhängigkeiten: fastapi, starlette, uvicorn, httpx, pydantic, PyJWT, jsonschema, PyYAML, …) | **keine bekannten Schwachstellen** (Treffer betrafen nur `pip`/`setuptools` des Dev-Venv, nicht das Deployment) |
| `npm audit --omit=dev` (apps/mobile) | 0 kritisch, 0 hoch, **12 mittel** – ausschließlich Expo-Build-Werkzeuge (`@expo/config-plugins`, `@expo/cli`, `expo-splash-screen`-Transitiv), laufen nur zur Build-Zeit, sind nicht im App-Bundle. Nachverfolgen: `npx expo install --fix` bei jedem SDK-Update |
| RLS gegen echtes PostgreSQL 16 | 23 Tests grün (siehe unten) |

## Findings
| ID | Schwere | Fund | Status |
|---|---|---|---|
| S-01 | hoch | Ungültige Tokens erzeugten ohne Supabase-Konfiguration `503 auth not configured` (verriet Konfiguration, unterschiedliches Verhalten) | **behoben** → immer `401` |
| S-02 | hoch | Release-Build ohne Backend-URL wäre still in den **Mock-Modus** gefallen (lokales Konto, „Pro“-Umschalter im Profil) | **behoben** (`resolveApiMode`: Mock nur in Debug-Builds oder per bewusstem `EXPO_PUBLIC_ALLOW_MOCK_IN_RELEASE`), Test `release safety` |
| S-03 | mittel | Audio-Transkription/LLM-Pfad: Bei Provider-Ausfall hätte die Pipeline 500 liefern können | **behoben** (sauberer Fallback, Test `test_pipeline_survives_provider_failure_without_leaking`) |
| S-04 | mittel | Rate-Limits nur prozesslokal | **behoben**: `RedisRateLimiter` (bei `REDIS_URL`), lokaler Fallback bei Redis-Fehlern. **[UNVERIFIZIERT gegen echten Redis]** |
| S-05 | mittel | Sprechübungen erzeugten zusätzlichen LLM/TTS-Aufwand (Kostenmissbrauch) | **behoben** (nur STT + Aussprache) |
| S-06 | mittel | XP-Farming über `/v1/lessons/complete` (Client-Wert) | **behoben** (Server vergibt festen Bonus; Test `test_xp_cannot_be_farmed…`) |
| S-07 | niedrig | Mock-Antworten/Stimmen könnten als Lerninhalt gespeichert werden | **behoben**: Mock-Turns landen nur im flüchtigen Puffer bzw. als `source: llm`/`pack_status: draft`-Übung ohne FSRS-Eintrag (`item_id = llm.turn`) |
| S-08 | mittel | Login-Härtung (Bot-Schutz, CAPTCHA, Login-Rate-Limits, E-Mail-Verifikationszwang) | **bewusst nicht aktiv** (Vorgabe: freies Testen). Feature-Flags in `remote_config.json`/Env (`FLAG_*`), Standard `false`. `require_email_verification` ist im Backend umgesetzt und getestet; `bot_protection`/`captcha`/`login_rate_limits` sind vorbereitete Schalter ohne Prüflogik (Captcha und Auth-Rate-Limits werden in Supabase-Auth konfiguriert). **Vor Launch aktivieren** |
| S-09 | niedrig | Webhook-Authentifizierung per Shared-Secret-Header (RevenueCat bietet kein HMAC) | akzeptiert: konstante Zeit-Vergleich (`hmac.compare_digest`), Rate-Limit, ohne Secret deaktiviert |
| S-10 | niedrig | `gitleaks`-Ignore im Repo | akzeptiert, begründet (siehe oben) |
| S-11 | mittel | JWT-Prüfung nur HS256 (Supabase-Projekte mit asymmetrischen Signing Keys benötigen JWKS) | offen bis Projekt-Konfiguration feststeht; in `SETUP_ANLEITUNG` dokumentiert **[UNVERIFIZIERT]** |

## Kontrollen im Detail
**Secrets**
- Kein Key im Client-Bundle: `apps/mobile/src/config/env.ts` liest ausschließlich `EXPO_PUBLIC_*`; Tests `no secrets in client env` und `test_repo_has_no_service_role_or_secret_in_mobile_sources` sichern das ab. Service-Role-, LLM-, STT-, TTS-, RevenueCat-Secrets nur serverseitig.
- `.env`/`*.pem`/`*.p8` in `.gitignore`, Vorlagen `.env.example` mit Platzhaltern.
- Keine Keys in Logs/Fehlern: Adapter geben nur HTTP-Statuscodes zurück; Test `test_provider_errors_and_logs_never_contain_keys`; `/health` und `/v1/config` enthalten keine Secrets (`test_health_and_config_expose_no_secrets`, Kostenlimits sind nicht öffentlich).
- Der Client ruft KI-Provider nie direkt auf (keine Provider-URLs im Client-Code).

**Supabase / Datenbank**
- RLS **aktiviert und erzwungen (`force`)** auf allen 11 Tabellen; Test prüft `pg_class` und die SQL-Dateien.
- Clients dürfen nur eigene Zeilen **lesen**; Schreibrechte auf Lernstand, Mitgliedschaft, Budget, FSRS-Zustand gibt es nicht (nur Backend/`service_role`) → niemand kann sich selbst Pro/XP/Herzen geben (getestet).
- `issued_exercises` (enthält Lösungen) und `analytics_events`: keinerlei Client-Zugriff.
- `service_role` nur im Backend (`PostgrestStore`), Tabellennamen kommen aus einer festen Liste, Löschen ohne Filter wird verweigert.
- Konto-Löschung: `ON DELETE CASCADE` aller Tabellen + Löschen des Auth-Users (`delete_auth_user`), getestet inkl. Cascade im echten Postgres.

**Backend**
- Eingabevalidierung mit Pydantic (`extra=forbid`, Längen/Wertebereiche, Regex für Sprache/Szenario), Test gegen SQL-/Pfad-förmige Eingaben.
- JWT: Signatur, `exp`, `aud=authenticated`, `sub` als UUID; `alg=none`, falsches Secret, abgelaufen, falsche Audience → 401 (Test).
- Autorisierung pro Ressource: alle Zugriffe über `user_id` aus dem Token; ausgegebene Übungen sind an `(user_id, exercise_id)` gebunden, einmalig einlösbar (IDOR-/Replay-Test).
- Auth auf allen `/v1`-Routen außer `config`, `languages`, `webhooks/revenuecat`, `audio` (Test iteriert über alle Routen).
- CORS: Standard leer (keine Origin erlaubt); Security-Header (`nosniff`, `X-Frame-Options`, `CSP default-src 'none'`, HSTS, `no-store`), Body-Limit 6 MB, `/docs` nur im Dev.
- Rate-Limits je Nutzer für Voice, Übungen und Standard; Kostenschutz durch Cent-Budget, Kill-Switch, Token-Caps, Audio-Länge ≤ 30 s.
- SSRF-Schutz für ausgehende URLs (`assert_public_https_url`: nur https, keine privaten/Loopback/Link-Local-Ziele) – genutzt für n8n.
- Audio-Pfad: `resolve()` verhindert Path-Traversal (Test).

**KI-spezifisch**
- LLM darf ausschließlich Schema-JSON liefern; alles andere wird verworfen, ein Retry, dann fester Fallback-Satz.
- Nutzertext ist immer Daten (`<user_utterance>`-Umhüllung, Tags werden entschärft); Injection-, Topic-, Moderations-Filter vor dem LLM; Output-Leak-Erkennung (Schlüsselmuster, System-Prompt-Marker).
- Vokabular-Whitelist je Level, Topic-Guard im Prompt und in der Eingabe, Token-Caps je Turn.
- System-Prompt und Keys werden nie ausgegeben (Leak-Tests).
- Grenzen: Regex-Filter sind keine vollständige Absicherung; Bake-off/Red-Teaming mit echtem Modell steht aus.

**Mobil**
- Token/Session in Keychain/Keystore (`expo-secure-store`, gechunkt), nie in AsyncStorage; Web-Vorschau nutzt `localStorage` nur für die Entwicklung.
- TLS (nur https-URLs außerhalb von Dev), keine sensiblen Daten in Logs, `ErrorBoundary` ohne Details, Debug-Funktionen (Pro-Umschalter, Test-Anzeigen-IDs) nur in Debug-Builds.
- Aufgenommene Audiodatei wird nach dem Lesen sofort gelöscht (`file.delete()`).

**Datenschutz**
- Audio wird nicht gespeichert: Test `test_audio_is_never_persisted` (weder Store noch Cache-Ordner enthalten das Nutzeraudio); nur eigenes TTS-Audio wird gecacht.
- Einwilligung für Sprachverarbeitung vor Audio-Upload (403 sonst), Analytics nur mit Einwilligung (außer Kauf/Trial-Events), Minderjährige: nie personalisierte Werbung (Backend + Client getestet).
- Export (`/v1/export`) und vollständige Löschung (inkl. Lernermodell, KI-Profil) implementiert und getestet; KI-Profil einzeln einsehbar/löschbar.
- Rechtliche Punkte: `docs/LEGAL_TODO.md`.

## Empfehlungen vor dem Launch
1. Login-Härtung aktivieren (S-08) und Supabase-Auth-Rate-Limits/E-Mail-Bestätigung konfigurieren.
2. JWT-Verifikation an das tatsächliche Supabase-Signing-Setup anpassen (S-11).
3. Red-Team-Test der Prompt-Injection-Abwehr mit dem echten Modell (Bake-off-Tooling nutzen).
4. Externen Pen-Test für Backend + Supabase-Policies beauftragen; Dependabot/Renovate und `gitleaks` in CI (ist in `.github/workflows/ci.yml` vorbereitet).

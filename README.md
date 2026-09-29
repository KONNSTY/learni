# Learni – KI-Sprachtutor (iOS zuerst, Android später)

Sprechen lernen im Gespräch mit einem KI-Tutor. Die **Lern-Engine steuert deterministisch** (FSRS, Curriculum, Herzen, Streaks); das LLM gestaltet nur das Gespräch und liefert ausschließlich validiertes JSON.

```
apps/mobile        Expo (React Native, TypeScript strikt, Reanimated, Rive) – iOS zuerst
apps/api           FastAPI-Orchestrator, Supabase-JWT, Provider-Abstraktion, Voice-Pipeline
  supabase/        SQL-Migrationen (RLS auf allen Tabellen) + Seed
packages/contracts OpenAPI + JSON-Schemas (Events, Übungen, Avatar-Manifest) -> generierte Typen
packages/tokens    Design-Tokens (Quelle für Figma und Code)
content/           Content-Packs (draft/reviewed/published), Prompts, Szenarien, Stimmen
scripts/           Content-Import, Audio-Prerender, Bake-off, Provider-Smoketest, SFX-Generator
docs/              STATE, DECISIONS, SETUP_ANLEITUNG, SECURITY_AUDIT, QA_TESTPLAN, ABNAHME, …
```

Design: [Figma-Datei](https://www.figma.com/design/tKQ47NKfbESKwNgBt8kVPy) (siehe `docs/DESIGN.md`).

## Schnellstart ohne Keys (Testmodus)

Ohne API-Keys laufen alle KI-Pfade mit **Mocks** (deterministischer Test-Tutor, lokaler Test-TTS). Im Client erscheint das Label „Testmodus“.

**App (iPhone per Expo Go):**
```bash
cd apps/mobile && npm install
npx expo start            # QR-Code mit der Kamera scannen (Expo Go)
```
Standard: lokaler Mock-Modus, kein Backend nötig (`EXPO_PUBLIC_API_MODE=mock`). Native Module (Rive, AdMob, RevenueCat) brauchen einen Dev Build; in Expo Go greifen Mock-Fallbacks (siehe `docs/SETUP_ANLEITUNG.md`, Abschnitt Dev Client).

**Backend lokal (optional, Gerät per LAN-IP):**
```bash
cd apps/api && python -m venv .venv && . .venv/bin/activate && pip install -e '.[dev]'
cp .env.example .env      # Werte bleiben leer -> Mocks
uvicorn learni_api.main:app --host 0.0.0.0 --port 8000
# App: EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000  (dann api-mode=http)
```

## Tests
```bash
cd apps/api && pytest                      # inkl. RLS-Tests gegen ein echtes temporäres PostgreSQL
cd apps/mobile && npm test && npm run typecheck
cd packages/contracts && npm run check     # generierte Typen aktuell?
python scripts/import_content.py validate  # Content-Packs prüfen
python scripts/smoketest_providers.py      # nach Eintragen der Keys (siehe docs/KEY_SMOKETEST.md)
```

## Env-Übersicht
| Variable | Wo | Zweck |
|---|---|---|
| `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_MODE` | `apps/mobile/.env` | Backend-URL / `mock` \| `http` |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | **öffentlich**, Anon-Key darf im Client stehen |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_ADMOB_*` | `apps/mobile/.env` | öffentliche SDK-Keys / Anzeigen-IDs |
| `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | `apps/api/.env` | **nur Server** |
| `LLM_GATEWAY_URL`, `LLM_API_KEY`, `LLM_MODEL_*` | `apps/api/.env` | LLM über LiteLLM/OpenRouter |
| `GROQ_API_KEY`, `ELEVENLABS_API_KEY` | `apps/api/.env` | STT |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | `apps/api/.env` | TTS + Aussprachebewertung |
| `REVENUECAT_WEBHOOK_SECRET` | `apps/api/.env` | Webhook-Signatur |
| `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET` | `apps/api/.env` | signierte Automations-Webhooks (später) |

Alle Secrets stehen ausschließlich serverseitig; `.env*` ist in `.gitignore`, Vorlagen sind `.env.example`.

## Weiterführend
`docs/SETUP_ANLEITUNG.md` (Drittanbieter Schritt für Schritt) · `docs/RELEASE_IOS.md` (TestFlight) · `docs/SECURITY_AUDIT.md` · `docs/QA_TESTPLAN.md` · `docs/ABNAHME.md` · `docs/LEGAL_TODO.md`

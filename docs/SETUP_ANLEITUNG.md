# Setup-Anleitung: Drittanbieter einbinden

Für erfahrene Entwickler. Reihenfolge: Supabase → LLM-Gateway → Groq → Azure → ElevenLabs → RevenueCat → AdMob/UMP → Apple Developer → Google Sign-In → n8n.
Nach jedem Schritt: `python scripts/smoketest_providers.py --only <provider>` (siehe `docs/KEY_SMOKETEST.md`).

**Grundregeln**
- Serverseitige Secrets stehen **nur** in `apps/api/.env` (lokal) bzw. in den Secrets der Hosting-Plattform. Sie gehören **nie** in `apps/mobile/.env`, nie in `EXPO_PUBLIC_*`, nie ins Repo.
- Der Client ruft KI-Provider **nie direkt** auf, alles läuft über das Backend.
- Fehlt ein Key, springt automatisch der Mock ein (Warnliste beim Start, Label „Testmodus“ im Client).

---

## 1. Supabase (Auth + Postgres)
1. Konto auf supabase.com, neues Projekt, **Region EU** (z. B. Frankfurt) wählen.
2. Projekt-Einstellungen → API: `Project URL`, `anon public key`, `service_role key`, unter *JWT Settings* das `JWT Secret`.
3. Env-Variablen:
   | Wert | Variable | Datei |
   |---|---|---|
   | Project URL | `SUPABASE_URL` (API) und `EXPO_PUBLIC_SUPABASE_URL` (App) | `apps/api/.env`, `apps/mobile/.env` |
   | anon key | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` (darf öffentlich sein, RLS schützt) |
   | JWT Secret | `SUPABASE_JWT_SECRET` | nur `apps/api/.env` |
   | service_role key | `SUPABASE_SERVICE_ROLE_KEY` | nur `apps/api/.env` – **nie** in die App |
4. Schema einspielen: SQL Editor → Inhalt von `apps/api/supabase/migrations/0001_schema.sql`, dann `0002_rls.sql`, dann `apps/api/supabase/seed.sql` ausführen (oder Supabase CLI: `supabase db push`).
5. Auth-Provider: Authentication → Providers → Email aktivieren (Magic Link), Apple und Google siehe Abschnitte 8/9. Redirect-URL `learni://auth-callback` unter *URL Configuration* eintragen.
6. Test: `python scripts/smoketest_providers.py --only supabase` (liest `languages` per Service-Key).
7. Fallstricke: Ohne `0002_rls.sql` sind Tabellen offen. `service_role` niemals im Client (Test `tests/app.test.ts` prüft, dass die App-Konfiguration nur `EXPO_PUBLIC_*` liest). Der JWT-Algorithmus ist HS256 – bei neuen Projekten mit asymmetrischen Signing Keys muss `apps/api/learni_api/auth.py` auf JWKS umgestellt werden **[UNVERIFIZIERT, je nach Projekt-Einstellung]**.

## 2. LLM-Gateway und Modell-Host
Zugang immer über ein OpenAI-kompatibles Gateway mit Failover (LiteLLM-Proxy selbst gehostet **oder** OpenRouter).
1. **LiteLLM**: `pip install 'litellm[proxy]'`, `config.yaml` mit `model_list` (Modellnamen laut Anbieter), `litellm --config config.yaml --port 4000`. Master-Key setzen.
   **OpenRouter**: Konto, API-Key, `LLM_GATEWAY_URL=https://openrouter.ai/api/v1`.
2. Modelle laut Spec (Gemma 4 26B A4B Standard, Qwen 3.5/3.6 Herausforderer, Gemma 4 E4B/Qwen ~9B für Bewertung, Gemma 4 31B+ für schwierige Sprachen): **die exakten Modell-IDs des gewählten Hosts eintragen** – nichts davon ist im Code fest verdrahtet **[UNVERIFIZIERT]**.
3. Env (nur `apps/api/.env`):
   ```
   LLM_GATEWAY_URL=https://<host>/v1
   LLM_API_KEY=<key>
   LLM_MODEL_DEFAULT=<model-id>
   LLM_MODEL_EVAL=<kleines-modell>
   LLM_MODEL_PREMIUM=<grosses-modell>
   LLM_FAILOVER_MODELS=<id1>,<id2>
   ```
4. Test: `python scripts/smoketest_providers.py --only llm` (prüft Schema-Konformität und gibt Latenz/Kosten je Tier aus). Vergleich der Modelle: `python scripts/bakeoff.py --language es --models a,b`.
5. Fallstricke: Nicht jedes Modell unterstützt `response_format=json_object` – notfalls im Adapter entfernen; die Schema-Validierung fängt Fehler trotzdem ab. Kosten pro Aufruf kommen aus dem LiteLLM-Header `x-litellm-response-cost`, sonst aus `costs.llm_cents_per_1k_tokens` in `remote_config.json` (Preis prüfen).

## 3. Groq (STT: Whisper Large v3 Turbo)
1. console.groq.com → API Keys → neuen Key erzeugen.
2. `GROQ_API_KEY=<key>` nur in `apps/api/.env`.
3. Test: `python scripts/smoketest_providers.py --only stt`. Der Sprach-Hint (Lernsprache) wird immer mitgesendet.
4. Fallstricke: Drittlandtransfer (USA) → `docs/LEGAL_TODO.md`. Stille erzeugt Halluzinationen („Thanks for watching“) – der Filter in `voice/pipeline.py` verwirft sie. Preis pro Stunde in `remote_config.json` prüfen **[UNVERIFIZIERT]**.

## 4. Azure (TTS + Aussprachebewertung)
1. Azure-Portal → Ressource „Speech“ anlegen, **Region EU** (z. B. `westeurope`).
2. `AZURE_SPEECH_KEY=<key1>`, `AZURE_SPEECH_REGION=westeurope` nur in `apps/api/.env`.
3. Stimmen in `content/voices.json` prüfen (Namen **[UNVERIFIZIERT]**).
4. Test: `python scripts/smoketest_providers.py --only tts,pron --language es`. **Locale-Abdeckung der Aussprachebewertung pro Sprache verifizieren** (Azure deckt nicht jede Locale ab; Lücken → Bewertung wird für die Sprache ausgelassen).
5. Fallstricke: Die REST-API liefert keine Viseme-Zeitstempel. Der Adapter berechnet sie heuristisch (`providers/visemes.py`); echte Zeitstempel gibt das Speech-SDK (`VisemeReceived`) – Erweiterung siehe `docs/DECISIONS.md`. Curriculum-Audio vorab rendern: `python scripts/prerender_audio.py --out ./.audio-cache/cdn`, auf ein CDN laden, `AUDIO_CDN_BASE=https://cdn.example.com` setzen.

## 5. ElevenLabs (optional: STT Scribe, Premium-TTS)
1. elevenlabs.io → API Key. `ELEVENLABS_API_KEY=<key>` nur in `apps/api/.env`.
2. Aktiviert automatisch den Premium-STT für Pro (`ELEVENLABS_STT_MODEL` optional; Standard `scribe_v1`, „Scribe v2“ **[UNVERIFIZIERT]**).
3. Test: `python scripts/smoketest_providers.py --only stt`.

## 6. RevenueCat (Abo, StoreKit 2 / Play Billing)
1. app.revenuecat.com → Projekt → App (iOS) hinzufügen, Bundle-ID `app.learni.mobile` (oder eigene, dann `IOS_BUNDLE_ID` setzen).
2. Produkte in App Store Connect anlegen (Abo-Gruppe „Learni Pro“, monatlich + jährlich, **7 Tage Trial** als Einführungsangebot), in RevenueCat importieren, **Entitlement `pro`** anlegen und Produkte zuordnen, Offering „default“ mit Packages *Monthly* und *Annual*.
3. Öffentlicher SDK-Key (`appl_…`) → `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in `apps/mobile/.env`.
4. Webhook: Integrationen → Webhooks → URL `https://<api-host>/v1/webhooks/revenuecat`, *Authorization header value* = ein langes Zufallsgeheimnis → identisch als `REVENUECAT_WEBHOOK_SECRET` in `apps/api/.env`.
5. **App-User-ID = Supabase-User-ID** (macht `purchases.init(userId)` automatisch). Anonyme IDs werden im Webhook ignoriert.
6. Test: In RevenueCat „Send test event“ (Antwort `ok`), Sandbox-Kauf mit Sandbox-Tester; Status danach in `/v1/state`.
7. Fallstricke: Ohne Key oder in Expo Go schaltet der **Sandbox-Mock** Free/Pro im Test um (Profil → „Test: → Pro“). RevenueCat braucht einen Dev Build (natives Modul). Ablauf/Kündigung: `EXPIRATION` setzt zurück auf Free, `CANCELLATION` lässt den Zugang bis zum Ablauf.

## 7. AdMob + UMP + ATT
1. admob.google.com → App hinzufügen (iOS), App-ID `ca-app-pub-…~…`; Anzeigenblöcke *Rewarded* und *Interstitial* anlegen.
2. Env (öffentlich): `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` in `apps/mobile/.env`; für den Build zusätzlich `ADMOB_IOS_APP_ID` als EAS-Env (app.config.ts liest sie). Ohne Angabe gelten Googles **Test-IDs**.
3. Consent: AdMob → Datenschutz & Mitteilungen → **EU-Einwilligungsnachricht (UMP/TCF)** erstellen und veröffentlichen. Der Code ruft `AdsConsent.gatherConsent()` und danach `initialize()` auf; ATT-Prompt vorher (nur Erwachsene / unbekanntes Alter nie personalisiert).
4. Mediation: in AdMob Mediation-Gruppen anlegen und Adapter je Netzwerk als Pod/Plugin ergänzen (Vorbereitung; noch keine Netzwerke eingebunden).
5. Test: Im Dev-Build `__DEV__` → Test-Anzeigen. Regeln im Code (`ads/policy.ts`): nie für Pro, nie mitten im Sprechfluss/Lektion, Minderjährige nur nicht-personalisiert. Rewarded ist immer freiwillig.
6. Fallstricke: `app-ads.txt`, SKAdNetwork-Einträge (Google-Plugin-Option `skAdNetworkItems`) vor Release ergänzen; Werbekennzeichnung in Store-Angaben.

## 8. Apple Developer (Sign in with Apple, TestFlight)
1. Apple-Developer-Konto (99 $/Jahr). Identifiers → App-ID `app.learni.mobile` mit Capability **Sign in with Apple**.
2. Supabase: Authentication → Providers → Apple aktivieren, *Client IDs* = Bundle-ID (nativer Flow `signInWithIdToken`).
3. TestFlight: siehe `docs/RELEASE_IOS.md`.
4. Fallstricke: Der native Apple-Login funktioniert nur im Dev Build/auf dem Gerät, nicht in Expo Go mit fremder Bundle-ID. Sign in with Apple ist Pflicht, sobald andere Social-Logins angeboten werden.

## 9. Google Sign-In
1. Google Cloud Console → OAuth-Zustimmungsbildschirm konfigurieren, OAuth-Client (Web) erzeugen.
2. Supabase: Providers → Google, Client ID/Secret eintragen, Redirect-URL von Supabase im Google-Client als autorisierte Weiterleitung hinterlegen.
3. Die App nutzt den OAuth-Browser-Flow (`signInWithOAuth` + `expo-web-browser`, Redirect `learni://auth-callback`); funktioniert auch in Expo Go über das Expo-Schema **[UNVERIFIZIERT]**.

## 10. n8n (später: E-Mail-Versand, Automationen)
Nur die Schnittstelle ist vorbereitet, **keine Zugangsdaten eingetragen**.
1. `N8N_BASE_URL=https://n8n.reglerproductions.com`, `N8N_WEBHOOK_SECRET=<langes Geheimnis>` in `apps/api/.env` (Base-URL muss `https` und öffentlich sein, SSRF-Schutz).
2. In n8n Webhook-Knoten mit Pfad `learni-<event>` (Punkte → Bindestriche, z. B. `learni-user-deleted`) und Signaturprüfung: Header `X-Learni-Timestamp`, `X-Learni-Signature` = HMAC-SHA256 über `<timestamp>.<body>` mit dem Secret; Zeitstempel > 5 min alt ablehnen.
3. Aufruf im Code: `learni_api.n8n.notify(settings, "user.deleted", {...})`.

---

## Dev Client statt Expo Go
Expo Go reicht für UI, Mocks, Haptik, Sound und Spracheingabe im Testmodus. Für **Rive, AdMob, RevenueCat** und Apple-Login brauchst du einen Development Build:
```bash
cd apps/mobile
npm install -g eas-cli && eas login
eas build:configure                                  # legt eas.json an
eas build --profile development --platform ios       # Dev Client (Simulator: --profile development-simulator)
npx expo start --dev-client
```
Alternativ lokal mit Xcode: `npx expo prebuild --platform ios && npx expo run:ios --device`.
**Hinweis:** `EXPO_PUBLIC_*` werden beim Bundlen fest eingebettet. Nach Änderung der Werte neu bundlen (`npx expo start --clear` bzw. `npx expo export --clear`), sonst liefert der Metro-Cache alte Werte. EAS-Builds starten sauber.
Backend erreichbar machen: LAN-IP in `EXPO_PUBLIC_API_URL` (Handy und Rechner im selben WLAN, API mit `--host 0.0.0.0`) oder Tunnel (`cloudflared tunnel --url http://localhost:8000`).

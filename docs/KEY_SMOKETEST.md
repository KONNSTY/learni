# Key-Smoketest

Nach dem Eintragen der Keys in `apps/api/.env` prüft ein Skript **jeden Provider einzeln** und gibt Latenz und Kosten pro Aufruf aus. Nicht konfigurierte Provider werden als `SKIP` gemeldet (dann läuft der Mock). Es werden keine Keys ausgegeben.

```bash
cd <repo>
set -a; . apps/api/.env; set +a
python scripts/smoketest_providers.py                    # alles
python scripts/smoketest_providers.py --only llm,stt     # einzelne Provider
python scripts/smoketest_providers.py --language hr      # andere Lernsprache
```

| Check | Prüft | Erwartung |
|---|---|---|
| `supabase` | Service-Key + Tabelle `languages` (Migrationen/Seed eingespielt) | `OK`, ≥ 1 Zeile |
| `llm/default`, `llm/eval`, `llm/premium` | Gateway, Modell-IDs, JSON-Schema-Konformität der Antwort | `OK`, Modellname, Kosten in Cent |
| `stt/groq`, `stt/elevenlabs` | Transkription mit Sprach-Hint (1,5 s Sinuston → leerer/kurzer Text ist korrekt) | `OK`, Latenz, Kosten |
| `tts/<provider>` | Synthese eines Beispielsatzes der Lernsprache | `OK`, Bytes > 500, Viseme-Anzahl |
| `pronunciation` | Azure Pronunciation Assessment inkl. Locale-Abdeckung laut `content/voices.json` | `OK`, Score |
| `revenuecat` | Webhook-Secret gesetzt (Sandbox-Kauf separat testen, siehe SETUP_ANLEITUNG 6) | `OK` |

**Richtwerte:** Sprach-Turn gesamt p50 1,2–1,6 s, Alarm ab 2 s (`voice.latency_alarm_ms`). Die Stufen-Latenzen (p50/p95) stehen im Dev-Endpoint `GET /v1/internal/latency` (nur `APP_ENV=dev`) und im Log bei Überschreitung.
**Kosten:** Preise in `remote_config.json` (`costs.*`) sind **[UNVERIFIZIERT]** und vor dem Launch gegen die Anbieter-Preislisten zu prüfen; Cent pro Nutzer und Tag werden aus den tatsächlichen Aufrufen summiert (`usage_daily.cost_cents`).

**Lücken pro Sprache** prüfen: `python scripts/smoketest_providers.py --only tts,pron --language hr` (und `id`, `tr`). Fehlt eine Stimme oder Locale, meldet der Test `FAIL` – dann Anbieter/Stimme in `content/voices.json` anpassen.

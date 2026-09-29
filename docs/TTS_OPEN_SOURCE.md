# Open-Source-TTS (lokaler Dev-Fallback und Kostenbremse)

**Gewählt: Piper** (CLI `piper`, ONNX-Stimmen, läuft offline auf CPU, kleine Latenz). Adapter: `apps/api/learni_api/providers/tts.py::PiperTTS`.

Begründung: einfache CLI-Anbindung ohne GPU, kleine Modelle, Batch-tauglich für `scripts/prerender_audio.py`. Alternativen (Kokoro, XTTS-Nachfolger) haben größere Modelle bzw. eingeschränkte Lizenz-/Sprachlage; **[UNVERIFIZIERT]** – Modelllisten und Lizenzen müssen vor dem Launch gegen die aktuellen Repositories geprüft werden (Lizenz je Stimme kann abweichen).

## Abdeckung der Launch-Sprachen (laut `content/voices.json`, [UNVERIFIZIERT])
| Sprache | Piper-Modell | Lücke? |
|---|---|---|
| es | `es_ES-davefx-medium` | – |
| en | `en_US-lessac-medium` | – |
| fr | `fr_FR-siwis-medium` | – |
| tr | `tr_TR-dfki-medium` | – |
| hr | – | **Lücke**: kein Modell hinterlegt -> Azure oder Mock |
| id | – | **Lücke**: kein Modell hinterlegt -> Azure oder Mock |

`PiperTTS.available_languages()` meldet zur Laufzeit, für welche Sprachen ein Modell installiert ist; fehlende Sprachen fallen im Pipeline-Pfad auf den Mock-Ton zurück. Prüfung mit `python scripts/smoketest_providers.py --only tts`.

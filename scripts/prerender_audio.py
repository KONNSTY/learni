#!/usr/bin/env python3
"""Curriculum-Audio vorab rendern (A1/A2) -> CDN-Struktur <lang>/<voice>/<key>.<ext> + manifest.json.

  python scripts/prerender_audio.py --out ./.audio-cache/cdn [--language es] [--speeds 1.0,0.8]
Provider laut Env (TTS_PROVIDER/AZURE_SPEECH_KEY/PIPER_CMD), sonst Mock. Ergebnis auf das CDN hochladen
und AUDIO_CDN_BASE setzen. Bereits vorhandene Dateien werden uebersprungen (Cache-Schluessel).
"""
import argparse
import asyncio
import json
from pathlib import Path

import _bootstrap  # noqa: F401
from _bootstrap import ROOT

from learni_api.config import RemoteConfig, Settings
from learni_api.content import ContentLibrary
from learni_api.providers.factory import build_providers
from learni_api.voice.tts_cache import TTSCache


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / ".audio-cache" / "cdn"))
    ap.add_argument("--language")
    ap.add_argument("--speeds", default="1.0,0.8")
    ap.add_argument("--include-draft", action="store_true", help="auch draft-Packs (nur Testumgebung)")
    a = ap.parse_args()
    s = Settings.from_env()
    prov = build_providers(s, RemoteConfig(s))
    lib = ContentLibrary(s.content_dir, a.include_draft or s.allow_draft_content)
    cache = TTSCache(Path(a.out), s.public_base_url, prov.tts, prov.voices, "")
    manifest, rendered, skipped, cost = {}, 0, 0, 0.0
    print(f"TTS-Provider: {prov.tts.name}{' (MOCK)' if prov.tts.is_mock else ''}")
    for lang in ([a.language] if a.language else [x["code"] for x in lib.languages]):
        texts = []
        for p in lib.packs(lang, "A2"):
            texts += [i["lemma"] for i in p.items] + [x["text"] for x in p.sentences]
        for text in dict.fromkeys(texts):
            for sp in (float(x) for x in a.speeds.split(",")):
                try:
                    hit = cache.find(lang, text, sp)
                    url, fresh = await cache.get(text, lang, sp)
                except Exception as e:  # noqa: BLE001 - Skript soll weiterlaufen und Luecken melden
                    print(f"  FEHLT {lang} {text!r} @{sp}: {type(e).__name__}")
                    continue
                rel = url.rsplit("/v1/audio/", 1)[-1]
                manifest.setdefault(lang, {})[f"{text}@{sp}"] = rel
                if hit:
                    skipped += 1
                else:
                    rendered += 1
                    cost += fresh.cost_cents if fresh else 0
    (Path(a.out) / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"gerendert={rendered} uebersprungen={skipped} Kosten~{cost:.3f} Cent -> {a.out}/manifest.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

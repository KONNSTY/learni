#!/usr/bin/env python3
"""Prueft jeden Provider einzeln (nach Eintragen der Keys) und gibt Latenz und Kosten pro Aufruf aus.

  python scripts/smoketest_providers.py [--language es] [--only llm,stt,tts,pron,supabase,revenuecat]
Exit-Code 0 = alle konfigurierten Provider ok. Nicht konfigurierte werden als SKIP (Mock aktiv) gemeldet.
Es werden keine Keys ausgegeben.
"""
import argparse
import asyncio
import io
import json
import struct
import time
import wave

import httpx

import _bootstrap  # noqa: F401

from learni_api.config import RemoteConfig, Settings
from learni_api.guardrails import validate_llm_turn
from learni_api.prompts import PromptLibrary
from learni_api.providers.factory import build_providers

TEXTS = {"es": "Hola, quiero un café, por favor.", "en": "Hello, I would like a coffee, please.", "fr": "Bonjour, je voudrais un café, s'il vous plaît.",
         "hr": "Bok, molim vas kavu.", "id": "Halo, saya mau kopi, tolong.", "tr": "Merhaba, bir kahve lütfen."}


def tone(seconds=1.0):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(16000)
        w.writeframes(b"".join(struct.pack("<h", 3000 if (i // 40) % 2 else -3000) for i in range(int(16000 * seconds))))
    return buf.getvalue()


def report(name, ok, ms, extra="", cost=None):
    c = f" cost={cost:.4f}c" if cost is not None else ""
    print(f"{'OK  ' if ok else 'FAIL'} {name:<14} {ms:7.0f} ms{c} {extra}")
    return ok


async def timed(coro):
    t = time.perf_counter()
    try:
        return await coro, (time.perf_counter() - t) * 1000, None
    except Exception as e:  # noqa: BLE001
        return None, (time.perf_counter() - t) * 1000, f"{type(e).__name__}: {str(e)[:120]}"


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", default="es")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = {x for x in a.only.split(",") if x}
    s = Settings.from_env()
    cfg = RemoteConfig(s)
    p = build_providers(s, cfg)
    text, lang, fails = TEXTS.get(a.language, TEXTS["en"]), a.language, 0
    want = lambda k: not only or k in only  # noqa: E731

    if want("supabase"):
        if s.supabase_url and s.supabase_service_role_key:
            async with httpx.AsyncClient(timeout=10) as c:
                r, ms, err = await timed(c.get(f"{s.supabase_url}/rest/v1/languages?select=code", headers={"apikey": s.supabase_service_role_key, "Authorization": f"Bearer {s.supabase_service_role_key}"}))
            ok = r is not None and r.status_code == 200 and len(r.json()) >= 1
            fails += not report("supabase", ok, ms, err or ("(Migrationen/Seed vorhanden)" if ok else f"HTTP {r.status_code}: Migrationen eingespielt?"))
        else:
            print("SKIP supabase       (SUPABASE_URL/SERVICE_ROLE_KEY fehlen -> MemoryStore)")

    if want("llm"):
        if p.llm.is_mock:
            print("SKIP llm            (kein Gateway -> Mock-Tutor)")
        else:
            prompts = PromptLibrary(s.content_dir)
            system = prompts.system_prompt(language=lang, level="A1", ui_language="de", tutor_profile=None, scenario_id=None, vocabulary=["hola"])
            for tier in ("default", "eval", "premium"):
                r, ms, err = await timed(p.llm.complete(system, [{"role": "user", "content": "<user_utterance>Hola</user_utterance>"}], max_tokens=200, model_tier=tier))
                valid = False
                if r:
                    try:
                        validate_llm_turn(r.text)
                        valid = True
                    except Exception as e:  # noqa: BLE001
                        err = f"Schema: {e}"
                fails += not report(f"llm/{tier}", valid, ms, err or r.model, r.cost_cents if r else None)

    if want("stt"):
        for label, prov in (("stt/groq", p.stt if not p.stt.is_mock else None), ("stt/elevenlabs", p.stt_premium)):
            if prov is None:
                print(f"SKIP {label:<14} (nicht konfiguriert)")
                continue
            r, ms, err = await timed(prov.transcribe(tone(1.5), language_hint=lang))
            fails += not report(label, r is not None, ms, err or f"text={r.text!r} (Sinuston -> leer/kurz erwartet)", r.cost_cents if r else None)

    if want("tts"):
        if p.tts.is_mock:
            print("SKIP tts            (kein Azure/Piper -> Mock-Ton)")
        else:
            r, ms, err = await timed(p.tts.synthesize(text, language=lang))
            fails += not report(f"tts/{p.tts.name}", r is not None and len(r.audio) > 500, ms, err or f"{len(r.audio)} bytes, visemes={len(r.visemes)}", r.cost_cents if r else None)

    if want("pron"):
        if p.pron.is_mock:
            print("SKIP pron           (kein AZURE_SPEECH_KEY -> Mock)")
        else:
            locales = {k: v["azure_locale"] for k, v in p.voices.items() if v.get("azure_locale")}
            print("Aussprache-Locale-Abdeckung laut Konfiguration:", ", ".join(f"{k}={v}" for k, v in locales.items()))
            r, ms, err = await timed(p.pron.assess(tone(1.5), reference_text=text, language=lang))
            fails += not report("pronunciation", r is not None, ms, err or f"score={r.overall}")

    if want("revenuecat"):
        print(("OK   revenuecat     Webhook-Secret gesetzt (Test: Sandbox-Kauf oder RevenueCat 'Send test event')" if s.revenuecat_webhook_secret else "SKIP revenuecat     (REVENUECAT_WEBHOOK_SECRET fehlt -> Webhook deaktiviert)"))
    print(f"\n{'ALLES OK' if not fails else str(fails) + ' Fehler'}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

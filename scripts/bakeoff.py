#!/usr/bin/env python3
"""Quality Bake-off (Spec 5.1, Phase 0): 30-50 Testdialoge je Sprache gegen konfigurierbare Modelle.

  python scripts/bakeoff.py --language es --models modelA,modelB --dialogs 30 --out bakeoff_es.md
Ohne Gateway-Keys laeuft der Mock (nur zum Testen des Ablaufs). Ausgabe: Markdown- und CSV-Tabelle mit automatischen
Metriken (valides Schema, Wortschatz-Quote, Laenge, Leak) und LEEREN Spalten fuer Muttersprachler-Bewertung
(Grammatik, Natuerlichkeit, Level-Treue, Halluzinationen; 1-5).
"""
import argparse
import asyncio
import csv
import io
import json

import _bootstrap  # noqa: F401
from _bootstrap import ROOT

from learni_api.config import RemoteConfig, Settings
from learni_api.content import ContentLibrary
from learni_api.guardrails import GuardrailError, unknown_word_ratio, validate_llm_turn, wrap_user_text
from learni_api.prompts import PromptLibrary
from learni_api.providers.llm_gateway import GatewayLLM
from learni_api.providers.mock import MockLLM

TEMPLATES = ["Hola, quiero practicar.", "Wie sage ich '{tr}'?", "Can we talk about {tr}?", "{lemma}", "Repeat please: {lemma}", "Ich verstehe nicht.", "Slower, please.", "What does '{lemma}' mean?"]


def build_dialogs(lib: ContentLibrary, lang: str, level: str, n: int) -> list[str]:
    items = [i for _, i in lib.items(lang, level)] or [{"lemma": "hola", "translations": {"en": "hello", "de": "hallo"}}]
    out = []
    for k in range(n):
        it = items[k % len(items)]
        out.append(TEMPLATES[k % len(TEMPLATES)].format(lemma=it["lemma"], tr=it["translations"]["en"]))
    return out


async def run_model(llm, prompts: PromptLibrary, lib: ContentLibrary, lang: str, level: str, dialogs: list[str], model_tier: str):
    system = prompts.system_prompt(language=lang, level=level, ui_language="de", tutor_profile=None, scenario_id=None, vocabulary=sorted(lib.vocabulary_whitelist(lang, level)))
    wl, rows = lib.vocabulary_whitelist(lang, level), []
    for text in dialogs:
        row = {"input": text, "valid": False, "unknown_ratio": None, "chars": 0, "output": "", "error": ""}
        try:
            res = await llm.complete(system, [{"role": "user", "content": wrap_user_text(text)}], max_tokens=220, model_tier=model_tier)
            turn = validate_llm_turn(res.text)
            ratio, unknown = unknown_word_ratio(turn["say"], wl)
            row.update(valid=True, unknown_ratio=round(ratio, 2), chars=len(turn["say"]), output=turn["say"], unknown=" ".join(unknown), cost_cents=round(res.cost_cents, 4))
        except (GuardrailError, Exception) as e:  # noqa: BLE001
            row["error"] = getattr(e, "code", type(e).__name__)
        rows.append(row)
    return rows


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", required=True)
    ap.add_argument("--level", default="A1")
    ap.add_argument("--models", default="", help="kommagetrennte Gateway-Modell-IDs; leer = Mock")
    ap.add_argument("--dialogs", type=int, default=30)
    ap.add_argument("--out", default="bakeoff.md")
    a = ap.parse_args()
    s = Settings.from_env()
    lib, prompts = ContentLibrary(s.content_dir, True), PromptLibrary(s.content_dir)
    dialogs = build_dialogs(lib, a.language, a.level, max(30, min(a.dialogs, 50)))
    models = [m for m in a.models.split(",") if m]
    runners = []
    if models and s.llm_gateway_url and s.llm_api_key:
        for m in models:
            runners.append((m, GatewayLLM(s.llm_gateway_url, s.llm_api_key, {"default": m}, [], float(RemoteConfig(s).get("costs", "llm_cents_per_1k_tokens", default=0.03)))))
    else:
        print("Kein Gateway konfiguriert -> Mock-Lauf (nur Ablauftest, keine Qualitaetsaussage).")
        runners.append(("mock", MockLLM(a.language)))
    md, buf = [f"# Bake-off {a.language} {a.level}\n"], io.StringIO()
    w = csv.writer(buf)
    w.writerow(["model", "input", "output", "valid", "unknown_ratio", "grammar_1_5", "naturalness_1_5", "level_fit_1_5", "hallucination_1_5", "notes"])
    for name, llm in runners:
        rows = await run_model(llm, prompts, lib, a.language, a.level, dialogs, "default")
        ok = sum(r["valid"] for r in rows)
        md.append(f"\n## {name}: valides Schema {ok}/{len(rows)}\n\n| # | Eingabe | Ausgabe | ok | unbekannt | Grammatik | Natuerlichkeit | Level | Halluz. |\n|---|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(rows, 1):
            md.append(f"| {i} | {r['input']} | {r['output'] or r['error']} | {'ja' if r['valid'] else 'nein'} | {r['unknown_ratio']} |  |  |  |  |")
            w.writerow([name, r["input"], r["output"] or r["error"], r["valid"], r["unknown_ratio"], "", "", "", "", ""])
    open(a.out, "w", encoding="utf-8").write("\n".join(md) + "\n")
    open(a.out.replace(".md", ".csv"), "w", encoding="utf-8").write(buf.getvalue())
    print(f"geschrieben: {a.out} und {a.out.replace('.md', '.csv')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

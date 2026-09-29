#!/usr/bin/env python3
"""Content-Pipeline: Packs validieren, Status setzen (draft -> reviewed -> published), Statistik, Audio-Manifest.

  python scripts/import_content.py validate
  python scripts/import_content.py stats
  python scripts/import_content.py set-status es-a1-basics reviewed --reviewer "Name"
"""
import argparse
import json
import sys

import _bootstrap  # noqa: F401
from _bootstrap import ROOT

from learni_api.content import LEVELS, VALID_STATUSES

PACKS = ROOT / "content" / "packs"
ORDER = ["draft", "reviewed", "published"]


def load_all():
    return [(f, json.loads(f.read_text(encoding="utf-8"))) for f in sorted(PACKS.glob("*/*.json"))]


def validate() -> int:
    errors, seen = [], set()
    langs = {x["code"] for x in json.loads((ROOT / "content" / "languages.json").read_text(encoding="utf-8"))}
    for f, d in load_all():
        where = f.relative_to(ROOT)
        for k in ("schema_version", "pack_id", "language", "level", "topic", "status", "items"):
            if k not in d:
                errors.append(f"{where}: missing {k}")
        if d.get("language") not in langs:
            errors.append(f"{where}: unknown language {d.get('language')}")
        if d.get("level") not in LEVELS:
            errors.append(f"{where}: bad level")
        if d.get("status") not in VALID_STATUSES:
            errors.append(f"{where}: bad status")
        if d.get("status") in ("reviewed", "published") and not d.get("reviewer"):
            errors.append(f"{where}: {d['status']} requires reviewer")
        for i in d.get("items", []):
            iid = i.get("item_id", "")
            if not iid.startswith(d["language"] + "."):
                errors.append(f"{where}: item id {iid!r} must start with language code")
            if iid in seen:
                errors.append(f"{where}: duplicate item id {iid}")
            seen.add(iid)
            if not (i.get("translations", {}).get("de") and i["translations"].get("en")):
                errors.append(f"{where}: {iid} needs de+en translations")
        for b in d.get("blanks", []):
            if b["answer"] not in b["options"] or "___" not in b["sentence"]:
                errors.append(f"{where}: bad blank {b.get('id')}")
        for s in d.get("sentences", []):
            if " ".join(s["tokens"]).replace("  ", " ") != s["text"]:
                errors.append(f"{where}: tokens of {s['id']} do not rebuild the text")
    for e in errors:
        print("ERROR", e)
    print(f"{len(load_all())} packs, {len(seen)} items, {len(errors)} errors")
    return 1 if errors else 0


def stats() -> int:
    for f, d in load_all():
        print(f"{d['pack_id']:<24} {d['status']:<10} items={len(d['items']):<3} sentences={len(d.get('sentences', []))} blanks={len(d.get('blanks', []))}")
    return 0


def set_status(pack_id: str, status: str, reviewer: str | None) -> int:
    for f, d in load_all():
        if d["pack_id"] == pack_id:
            if ORDER.index(status) > ORDER.index(d["status"]) + 1:
                print("ERROR: status can only advance one step at a time (draft -> reviewed -> published)")
                return 1
            if status in ("reviewed", "published") and not (reviewer or d.get("reviewer")):
                print("ERROR: --reviewer required (native speaker review)")
                return 1
            d["status"] = status
            d["reviewer"] = reviewer or d.get("reviewer")
            f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"{pack_id} -> {status}")
            return 0
    print("ERROR: pack not found")
    return 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("validate")
    sub.add_parser("stats")
    s = sub.add_parser("set-status")
    s.add_argument("pack_id")
    s.add_argument("status", choices=ORDER)
    s.add_argument("--reviewer")
    a = ap.parse_args()
    sys.exit({"validate": validate, "stats": stats}.get(a.cmd, lambda: set_status(a.pack_id, a.status, a.reviewer))())

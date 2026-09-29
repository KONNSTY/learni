"""Gemeinsamer Import-Pfad fuer Skripte: macht `learni_api` importierbar (ohne Installation)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

"""Prompt-Bibliothek aus dem Repo (content/prompts), nicht im Code."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


class PromptLibrary:
    def __init__(self, content_dir: Path):
        self.dir = Path(content_dir) / "prompts"
        self.scen_dir = Path(content_dir) / "scenarios"
        self.template = (self.dir / "tutor_system.md").read_text(encoding="utf-8")
        self.levels: dict[str, str] = yaml.safe_load((self.dir / "levels.yaml").read_text(encoding="utf-8"))
        self.correction = (self.dir / "correction_style.md").read_text(encoding="utf-8").strip()
        self.injection = (self.dir / "injection_defense.md").read_text(encoding="utf-8").strip()

    def language_meta(self, code: str) -> dict[str, Any]:
        f = self.dir / f"tutor_{code}.yaml"
        if not f.exists():
            raise KeyError(f"no prompt file for language {code}")
        return yaml.safe_load(f.read_text(encoding="utf-8"))

    def scenario(self, scenario_id: str) -> dict[str, Any] | None:
        f = self.scen_dir / f"{scenario_id}.yaml"
        return yaml.safe_load(f.read_text(encoding="utf-8")) if f.exists() else None

    def scenarios(self) -> list[dict[str, Any]]:
        return [yaml.safe_load(f.read_text(encoding="utf-8")) for f in sorted(self.scen_dir.glob("*.yaml"))]

    def system_prompt(self, *, language: str, level: str, ui_language: str, tutor_profile: dict[str, Any] | None,
                      scenario_id: str | None, vocabulary: list[str]) -> str:
        meta = self.language_meta(language)
        scen = self.scenario(scenario_id) if scenario_id else None
        profile_txt = "keine Angaben"
        if tutor_profile:
            parts = []
            for key in ("goals", "interests", "typical_mistakes"):
                if tutor_profile.get(key):
                    parts.append(f"{key}: {', '.join(map(str, tutor_profile[key]))}")
            if tutor_profile.get("pace"):
                parts.append(f"pace: {tutor_profile['pace']}")
            profile_txt = "; ".join(parts) or profile_txt
        return self.template.format(
            language_name=meta["language_name"], language_code=meta["language_code"], level=level,
            level_rules=self.levels[level], correction_style=self.correction + "\n" + self.injection,
            ui_language=ui_language, tutor_profile=profile_txt,
            scenario=scen["setup"] if scen else "Freies, kurzes Übungsgespräch.",
            vocabulary=", ".join(vocabulary[:80]) or "-",
        )

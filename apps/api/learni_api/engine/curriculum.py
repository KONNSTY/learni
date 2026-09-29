"""Curriculum-Graph pro Sprache: CEFR A1..B2 -> Themen -> Items (nach Frequenz) + Grammatikpunkte."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..content import LEVELS, ContentLibrary

# Ziel -> bevorzugte Themen [ANNAHME]
GOAL_TOPICS = {"travel": ["basics", "food_drink"], "work": ["basics", "daily_life"], "family": ["basics", "daily_life"], "fun": ["basics", "food_drink"]}
SELF_LEVEL_TO_CEFR = {"none": "A1", "few_words": "A1", "simple_conversations": "A2", "everyday": "B1"}


@dataclass
class Node:
    level: str
    topic: str
    item_ids: list[str] = field(default_factory=list)
    grammar: list[str] = field(default_factory=list)


def build_graph(lib: ContentLibrary, language: str) -> list[Node]:
    nodes: list[Node] = []
    for p in lib.packs(language):
        g = [b.get("grammar_point") for b in p.blanks if b.get("grammar_point")]
        nodes.append(Node(p.level, p.topic, [i["item_id"] for i in p.items], sorted(set(g))))
    return nodes


def placement_level(self_level: str, adaptive: list[dict[str, Any]]) -> str:
    """Selbsteinschaetzung + 2..3 adaptive Fragen. Richtig-Quote verschiebt hoechstens +-1 Level."""
    base = SELF_LEVEL_TO_CEFR.get(self_level, "A1")
    idx = LEVELS.index(base)
    if len(adaptive) >= 2 and self_level != "none":  # explizite Anfaenger bleiben A1
        acc = sum(1 for a in adaptive if a.get("correct")) / len(adaptive)
        if acc >= 0.99 and idx < 2:
            idx += 1
        elif acc <= 0.34 and idx > 0:
            idx -= 1
    return LEVELS[idx]


def plan(lib: ContentLibrary, language: str, level: str, goal: str, daily_minutes: int) -> dict[str, Any]:
    available = lib.topics(language, level)
    preferred = [t for t in GOAL_TOPICS.get(goal, []) if t in available]
    topics = preferred + [t for t in available if t not in preferred]
    n_items = len(lib.items(language, level))
    # grobe Schaetzung: 30 Items je Level-Etappe, ~4 neue Items pro 10 Minuten und Tag [ANNAHME]
    per_day = max(1, daily_minutes * 4 // 10)
    weeks = max(2, round(min(n_items, 30) / per_day / 7 * 4)) if n_items else 12
    return {"language": language, "level": level, "weeks_to_next_level": int(weeks), "daily_goal_minutes": daily_minutes, "topics": topics, "paywall_trigger": "onboarding_plan"}

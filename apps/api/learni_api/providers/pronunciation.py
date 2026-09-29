"""Aussprachebewertung ueber Azure Pronunciation Assessment (REST, kurzes Audio). Locale-Abdeckung pro Sprache
muss per scripts/smoketest_providers verifiziert werden [UNVERIFIZIERT]."""
from __future__ import annotations

import base64
import json

import httpx

from .base import PronResult, ProviderError


class AzurePronunciation:
    name, is_mock = "azure-pron", False

    def __init__(self, key: str, region: str, locales: dict[str, str], client: httpx.AsyncClient | None = None):
        self.key, self.region, self.locales = key, region, locales
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))

    @staticmethod
    def header(reference_text: str) -> str:
        cfg = {"ReferenceText": reference_text, "GradingSystem": "HundredMark", "Granularity": "Word", "Dimension": "Comprehensive", "EnableMiscue": True}
        return base64.b64encode(json.dumps(cfg).encode()).decode()

    async def assess(self, audio: bytes, *, reference_text: str, language: str) -> PronResult:
        locale = self.locales.get(language)
        if not locale:
            raise ProviderError(f"no locale for {language}")
        url = f"https://{self.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1"
        r = await self.client.post(url, params={"language": locale, "format": "detailed"}, content=audio,
                                   headers={"Ocp-Apim-Subscription-Key": self.key, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
                                            "Pronunciation-Assessment": self.header(reference_text), "Accept": "application/json"})
        if r.status_code >= 400:
            raise ProviderError(f"azure pron HTTP {r.status_code}")
        best = (r.json().get("NBest") or [{}])[0]
        words = [{"word": w.get("Word"), "score": (w.get("PronunciationAssessment") or {}).get("AccuracyScore")} for w in best.get("Words", [])]
        overall = (best.get("PronunciationAssessment") or {}).get("PronScore", 0.0)
        return PronResult(float(overall), words, False)

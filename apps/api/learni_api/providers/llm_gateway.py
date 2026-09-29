"""LLM ueber OpenAI-kompatibles Gateway (LiteLLM-Proxy oder OpenRouter) mit Modell-Failover.

Modell-IDs sind Konfiguration (LLM_MODEL_*), nichts davon ist im Code verdrahtet.
"""
from __future__ import annotations

import httpx

from .base import LLMResult, ProviderError

RETRY_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class GatewayLLM:
    name, is_mock = "llm-gateway", False

    def __init__(self, base_url: str, api_key: str, models: dict[str, str], failover: list[str],
                 cost_cents_per_1k_tokens: float = 0.03, client: httpx.AsyncClient | None = None):
        self.base = base_url.rstrip("/")
        self.key = api_key
        self.models = models  # tier -> model id: default | eval | premium
        self.failover = failover
        self.cost_per_1k = cost_cents_per_1k_tokens
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))

    def _chain(self, tier: str) -> list[str]:
        first = self.models.get(tier) or self.models.get("default")
        chain = [m for m in [first, *self.failover] if m]
        return list(dict.fromkeys(chain))

    async def complete(self, system: str, messages: list[dict[str, str]], *, max_tokens: int, model_tier: str = "default") -> LLMResult:
        last_err: Exception | None = None
        for model in self._chain(model_tier):
            body = {"model": model, "max_tokens": max_tokens, "temperature": 0.4,
                    "messages": [{"role": "system", "content": system}, *messages],
                    "response_format": {"type": "json_object"}}
            try:
                r = await self.client.post(f"{self.base}/chat/completions", json=body, headers={"Authorization": f"Bearer {self.key}"})
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last_err = e
                continue
            if r.status_code in RETRY_STATUS:
                last_err = ProviderError(f"{model}: HTTP {r.status_code}")
                continue
            if r.status_code >= 400:
                raise ProviderError(f"{model}: HTTP {r.status_code}")
            data = r.json()
            usage = data.get("usage") or {}
            tin, tout = int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0))
            header_cost = r.headers.get("x-litellm-response-cost")  # USD, falls vorhanden
            cents = float(header_cost) * 100 if header_cost else (tin + tout) / 1000 * self.cost_per_1k
            return LLMResult(data["choices"][0]["message"]["content"], model, tin, tout, cents, False)
        raise ProviderError(f"all models failed: {last_err}")

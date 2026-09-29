import asyncio
import base64
import json

import httpx
import pytest
from conftest import ROOT, wav_bytes

from learni_api.config import RemoteConfig, Settings
from learni_api.providers.base import ProviderError
from learni_api.providers.factory import build_providers
from learni_api.providers.llm_gateway import GatewayLLM
from learni_api.providers.pronunciation import AzurePronunciation
from learni_api.providers.stt import ElevenLabsSTT, GroqSTT
from learni_api.providers.tts import AzureTTS, ElevenLabsTTS, PiperTTS

VOICES = {k: v for k, v in json.loads((ROOT / "content" / "voices.json").read_text()).items() if not k.startswith("_")}


def run(coro):
    return asyncio.run(coro)


def client_with(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_factory_falls_back_to_mocks_without_keys():
    s = Settings(content_dir=ROOT / "content")
    p = build_providers(s, RemoteConfig(s))
    assert set(p.mock_names) == {"llm", "stt", "tts", "pronunciation"} and p.stt_premium is None


def test_factory_uses_real_adapters_with_keys():
    s = Settings(content_dir=ROOT / "content", llm_gateway_url="https://gw.example.com/v1", llm_api_key="k", llm_model_default="m",
                 groq_api_key="g", azure_speech_key="a", elevenlabs_api_key="e")
    p = build_providers(s, RemoteConfig(s))
    assert p.mock_names == [] and p.stt_premium is not None and p.tts.name == "azure-tts"


def test_missing_keys_warning_list():
    s = Settings(content_dir=ROOT / "content")
    assert len(s.missing_keys()) == 5
    s.groq_api_key = "x"
    assert not any("GROQ" in m for m in s.missing_keys())


def test_llm_gateway_failover_and_request_shape():
    seen = []

    def handler(req: httpx.Request):
        body = json.loads(req.content)
        seen.append(body["model"])
        assert req.headers["authorization"] == "Bearer k" and req.url.path == "/v1/chat/completions"
        assert body["messages"][0]["role"] == "system"
        if body["model"] == "primary":
            return httpx.Response(503)
        return httpx.Response(200, json={"choices": [{"message": {"content": "{}"}}], "usage": {"prompt_tokens": 100, "completion_tokens": 50}}, headers={"x-litellm-response-cost": "0.0002"})

    llm = GatewayLLM("https://gw.example.com/v1", "k", {"default": "primary"}, ["backup"], client=client_with(handler))
    r = run(llm.complete("sys", [{"role": "user", "content": "hi"}], max_tokens=50))
    assert seen == ["primary", "backup"] and r.model == "backup" and r.cost_cents == pytest.approx(0.02) and r.output_tokens == 50


def test_llm_gateway_all_fail_raises_and_client_error_no_failover():
    llm = GatewayLLM("https://gw", "k", {"default": "a"}, ["b"], client=client_with(lambda r: httpx.Response(500)))
    with pytest.raises(ProviderError):
        run(llm.complete("s", [], max_tokens=5))
    calls = []
    llm2 = GatewayLLM("https://gw", "k", {"default": "a"}, ["b"], client=client_with(lambda r: (calls.append(1), httpx.Response(401))[1]))
    with pytest.raises(ProviderError):
        run(llm2.complete("s", [], max_tokens=5))
    assert len(calls) == 1


def test_groq_stt_request_has_language_hint_and_word_timestamps():
    def handler(req: httpx.Request):
        body = req.content.decode("latin-1")
        assert 'name="language"' in body and "\r\n\r\nes\r\n" in body and "whisper-large-v3-turbo" in body and "word" in body
        assert req.headers["authorization"] == "Bearer g"
        return httpx.Response(200, json={"text": " hola ", "language": "es", "duration": 1.2, "words": [{"word": "hola", "start": 0, "end": 0.5}]})

    r = run(GroqSTT("g", client=client_with(handler)).transcribe(wav_bytes(), language_hint="es"))
    assert r.text == "hola" and r.words[0]["word"] == "hola" and r.cost_cents > 0


def test_elevenlabs_stt_parses_words():
    h = lambda req: httpx.Response(200, json={"text": "hola", "language_code": "es", "words": [{"text": "hola", "start": 0, "end": 0.4, "type": "word"}, {"text": " ", "type": "spacing"}]})  # noqa: E731
    r = run(ElevenLabsSTT("e", client=client_with(h)).transcribe(wav_bytes(), language_hint="es"))
    assert r.text == "hola" and len(r.words) == 1
    with pytest.raises(ProviderError):
        run(ElevenLabsSTT("e", client=client_with(lambda q: httpx.Response(429))).transcribe(b"", language_hint="es"))


def test_azure_tts_ssml_and_headers():
    def handler(req: httpx.Request):
        assert req.url.host == "westeurope.tts.speech.microsoft.com"
        assert req.headers["ocp-apim-subscription-key"] == "k" and req.headers["content-type"] == "application/ssml+xml"
        ssml = req.content.decode()
        assert "es-ES-ElviraNeural" in ssml and "rate='-20%'" in ssml and "&lt;b&gt;" in ssml  # Text ist escaped
        return httpx.Response(200, content=b"ID3mp3")

    tts = AzureTTS("k", "westeurope", VOICES, client=client_with(handler))
    r = run(tts.synthesize("<b>Hola</b>", language="es", speed=0.8))
    assert r.mime == "audio/mpeg" and r.visemes[-1]["viseme"] == 0 and r.cost_cents > 0
    with pytest.raises(ProviderError):
        run(tts.synthesize("x", language="zz"))


def test_elevenlabs_tts_needs_voice():
    tts = ElevenLabsTTS("k", {"es": "voiceid"}, client=client_with(lambda r: httpx.Response(200, content=b"mp3")))
    assert run(tts.synthesize("Hola", language="es")).audio == b"mp3"
    with pytest.raises(ProviderError):
        run(tts.synthesize("Hola", language="fr"))


def test_piper_reports_available_languages(tmp_path):
    (tmp_path / "es_ES-davefx-medium.onnx").write_bytes(b"x")
    p = PiperTTS("piper", str(tmp_path), VOICES)
    assert p.available_languages() == ["es"]
    with pytest.raises(ProviderError):
        run(p.synthesize("Hallo", language="hr"))  # Luecke dokumentiert: kein Piper-Modell


def test_azure_pronunciation_header_and_parse():
    def handler(req: httpx.Request):
        cfg = json.loads(base64.b64decode(req.headers["pronunciation-assessment"]))
        assert cfg["ReferenceText"] == "hola" and cfg["GradingSystem"] == "HundredMark"
        assert req.url.params["language"] == "es-ES"
        return httpx.Response(200, json={"NBest": [{"PronunciationAssessment": {"PronScore": 88.5}, "Words": [{"Word": "hola", "PronunciationAssessment": {"AccuracyScore": 90}}]}]})

    p = AzurePronunciation("k", "westeurope", {"es": "es-ES"}, client=client_with(handler))
    r = run(p.assess(wav_bytes(), reference_text="hola", language="es"))
    assert r.overall == 88.5 and r.words == [{"word": "hola", "score": 90}]
    with pytest.raises(ProviderError):
        run(p.assess(b"", reference_text="x", language="xx"))

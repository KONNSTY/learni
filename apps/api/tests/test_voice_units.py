import asyncio

from conftest import wav_bytes

from learni_api.providers.mock import MockLLM, MockTTS, make_wav
from learni_api.providers.visemes import text_to_visemes
from learni_api.voice.pipeline import CancelToken, LatencyTracker, audio_rms, hallucination_filter, split_sentences
from learni_api.voice.tts_cache import cache_key, cdn_path


def test_split_sentences():
    assert split_sentences("Hola. ¿Cómo estás? Bien") == ["Hola.", "¿Cómo estás?", "Bien"]


def test_latency_percentiles():
    t = LatencyTracker()
    for v in range(1, 101):
        t.record("stt", v)
    assert t.percentile("stt", 50) in (50, 51) and t.percentile("stt", 95) in (95, 96)
    assert t.percentile("none", 50) is None


def test_hallucination_filter():
    assert hallucination_filter("Thanks for watching!", 2.0, 5000) == ""
    assert hallucination_filter("Untertitel der Amara.org-Community", 2.0, 5000) == ""
    assert hallucination_filter("gracias por favor bien", 1.0, 20) == ""  # Stille + Text
    assert hallucination_filter("hola", 1.0, 5000) == "hola"


def test_audio_rms_silence_vs_tone():
    silent = make_wav(200, freq=0.0001)
    assert audio_rms(wav_bytes(0.5, amp=0)) == 0.0
    assert audio_rms(wav_bytes(0.5, amp=8000)) > 1000
    assert audio_rms(b"not a wav") is None
    assert silent


def test_visemes_range_and_ends_silent():
    v = text_to_visemes("Quiero un café, por favor", 1500)
    assert v[-1] == {"t_ms": 1500, "viseme": 0}
    assert all(0 <= x["viseme"] <= 21 for x in v) and [x["t_ms"] for x in v] == sorted(x["t_ms"] for x in v)
    assert text_to_visemes("", 100) == [{"t_ms": 0, "viseme": 0}]


def test_mock_tts_is_valid_wav_and_scales_with_speed():
    fast = asyncio.run(MockTTS().synthesize("Buenos días", language="es", speed=1.0))
    slow = asyncio.run(MockTTS().synthesize("Buenos días", language="es", speed=0.5))
    assert fast.audio[:4] == b"RIFF" and slow.duration_ms > fast.duration_ms and fast.mock


def test_mock_llm_is_deterministic():
    async def run():
        m = MockLLM()
        a = await m.complete("Spanisch (es)", [{"role": "user", "content": "x"}], max_tokens=10)
        b = await m.complete("Spanisch (es)", [{"role": "user", "content": "y"}], max_tokens=10)
        return a.text == b.text
    assert asyncio.run(run())


def test_cache_key_dimensions():
    base = cache_key("Hola", "v", "es", 1.0)
    assert base != cache_key("Hola", "v", "es", 0.8) and base != cache_key("Hola", "w", "es", 1.0)
    assert base != cache_key("Hola!", "v", "es", 1.0) and base == cache_key(" Hola ", "v", "es", 1.0)
    assert cdn_path("es", "es-ES-ElviraNeural", base, "mp3").startswith("es/es-ES-ElviraNeural/")


def test_cancel_token_barge_in(client):
    """Barge-in: bei gesetztem Cancel wird nach STT abgebrochen (kein LLM/TTS)."""
    from learni_api.voice.pipeline import TurnInput
    pipe = client.app.state.pipeline
    tok = CancelToken()
    tok.cancel()
    res2 = asyncio.run(pipe.turn(TurnInput("u", "es", "A1", "de", "free", audio=wav_bytes(1), audio_seconds=1), tok))
    assert res2.cancelled and res2.events == []

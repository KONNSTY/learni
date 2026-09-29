import base64
import io
import json
import struct
import uuid
import wave
from pathlib import Path

import jsonschema
import pytest
from fastapi.testclient import TestClient

from learni_api.app import create_app
from learni_api.config import Settings
from learni_api.store import MemoryStore

ROOT = Path(__file__).resolve().parents[3]
SCHEMAS = ROOT / "packages" / "contracts" / "schemas"


def load_schema(name: str) -> dict:
    return json.loads((SCHEMAS / name).read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch, tmp_path):
    for k in list(__import__("os").environ):
        if k.startswith(("SUPABASE_", "LLM_", "GROQ_", "ELEVENLABS_", "AZURE_", "REVENUECAT_", "N8N_", "PIPER_", "FLAG_", "TTS_")):
            monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("AUDIO_CACHE_DIR", str(tmp_path / "audio"))


@pytest.fixture(autouse=True)
def _relaxed_limits(monkeypatch):
    from learni_api import security
    monkeypatch.setattr(security, "LIMITS", {k: (1000.0, 100000) for k in security.LIMITS})


@pytest.fixture
def settings():
    return Settings(app_env="dev", content_dir=ROOT / "content")


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def app(settings, store):
    return create_app(settings, store)


@pytest.fixture
def client(app):
    return TestClient(app)


def new_user() -> tuple[str, dict]:
    uid = str(uuid.uuid4())
    return uid, {"Authorization": f"Bearer dev:{uid}"}


@pytest.fixture
def user():
    return new_user()


def wav_bytes(seconds: float = 1.0, amp: int = 6000) -> bytes:
    rate = 16000
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", amp if (i // 40) % 2 else -amp) for i in range(int(rate * seconds))))
    return buf.getvalue()


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def validate_events(events: list[dict]) -> None:
    schema = load_schema("events.schema.json")
    for e in events:
        jsonschema.validate(e, schema)

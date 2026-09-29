#!/usr/bin/env python3
"""Erzeugt alle UI-Soundeffekte selbst (reine Synthese, keine fremden Samples) -> apps/mobile/assets/sfx/*.wav.
Lizenz der erzeugten Dateien: CC0-1.0 (siehe assets/sfx/LICENSES.md). Aufruf: python scripts/gen_sfx.py"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / "apps" / "mobile" / "assets" / "sfx"


def env(i, n, attack=0.01, release=0.15):
    t = i / RATE
    dur = n / RATE
    a = min(1.0, t / attack) if attack else 1.0
    r = min(1.0, (dur - t) / release) if release else 1.0
    return max(0.0, min(a, r))


def tone(freq, ms, vol=0.5, f_end=None, attack=0.005, release=0.08, shape="sine"):
    n = int(RATE * ms / 1000)
    out, phase = [], 0.0
    for i in range(n):
        f = freq if f_end is None else freq + (f_end - freq) * i / n
        phase += 2 * math.pi * f / RATE
        s = math.sin(phase)
        if shape == "bell":
            s = 0.7 * s + 0.3 * math.sin(2.76 * phase)
        out.append(vol * env(i, n, attack, release) * s)
    return out


def seq(*parts):
    r = []
    for p in parts:
        r += p
    return r


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) / len(tracks) * 1.4 for i in range(n)]


def noise(ms, vol=0.4, seed=1):
    rnd = random.Random(seed)
    n = int(RATE * ms / 1000)
    return [vol * env(i, n, 0.001, 0.05) * (rnd.random() * 2 - 1) * (1 - i / n) for i in range(n)]


def save(name, samples):
    OUT.mkdir(parents=True, exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = min(1.0, 0.85 / peak)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * scale)) * 32767)) for s in samples))


NOTE = {"C5": 523.25, "E5": 659.25, "G5": 783.99, "C6": 1046.5, "D5": 587.33, "A5": 880.0, "E6": 1318.5}

save("tap", tone(1300, 35, 0.5, f_end=900, attack=0.001, release=0.02))
save("correct", seq(tone(660, 110, 0.5, shape="bell"), tone(990, 190, 0.5, shape="bell", release=0.15)))
save("wrong", seq(tone(190, 140, 0.5, f_end=150), tone(150, 160, 0.45, f_end=120, release=0.12)))
save("lesson_complete", seq(*[tone(NOTE[n], 140, 0.5, shape="bell") for n in ("C5", "E5", "G5")], mix(tone(NOTE["C6"], 700, 0.5, shape="bell", release=0.4), tone(NOTE["G5"], 700, 0.4, shape="bell", release=0.4))))
save("streak", mix(tone(400, 420, 0.4, f_end=900, release=0.2), seq([0.0] * int(RATE * 0.25), tone(NOTE["A5"], 350, 0.5, shape="bell", release=0.25))))
save("level_up", seq(*[tone(NOTE[n], 130, 0.5, shape="bell") for n in ("C5", "D5", "E5", "G5", "A5")], tone(NOTE["E6"], 800, 0.5, shape="bell", release=0.5)))
save("hearts_empty", seq(tone(120, 180, 0.7, f_end=70, release=0.12), [0.0] * int(RATE * 0.08), tone(110, 260, 0.7, f_end=55, release=0.2)))
save("heart_break", mix(noise(110, 0.5), tone(500, 200, 0.5, f_end=140, release=0.15)))
save("mic_on", seq(tone(600, 60, 0.45), tone(900, 90, 0.45)))
save("mic_off", seq(tone(900, 60, 0.4), tone(600, 90, 0.4)))
print("SFX geschrieben nach", OUT)

#!/usr/bin/env python3
"""Compose the intro's action soundtrack (synthesized from scratch: no samples, no licences).

The track follows the intro's timeline exactly (see src/scenes/IntroScene.ts):
  0.00  dark drone, the title slams in at 0.56 with a big impact
  3.00  first fighter; every fighter gets 3.5 s = 2 bars at 137.14 BPM, with an impact on the
        downbeat when the next fighter appears
  end   final slam for ENTER THE TRENCHES, then a long tail

Hybrid trailer style in D minor: taiko-like booms, punchy kick/snare, hats, a distorted 16th-note
bass ostinato, brass stabs, a pad, risers, and the energy stepping up every 8 fighters.

Usage: python3 scripts/make_intro_music.py        (writes public/assets/music/intro.mp3)
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "music" / "intro.mp3"

SR = 44100
TITLE = 3.0
SEG = 3.5
BEAT = SEG / 8  # 2 bars of 4/4 per fighter
STEP = BEAT / 4  # 16th note
TITLE_SLAM = 0.56
END_SLAM = 0.94
TAIL = 4.2

rng = np.random.default_rng(7)


def t_of(n):
    return np.arange(n) / SR


def env(n, attack, decay):
    t = t_of(n)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def saw(freq, n, detune=0.0):
    t = t_of(n)
    out = np.zeros(n)
    for d in ([0.0] if not detune else [-detune, 0.0, detune]):
        ph = (freq * (1 + d) * t + rng.random()) % 1.0
        out += 2 * ph - 1
    return out / (1 if not detune else 3)


def note(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + 12 * (o - 4)) / 12)


# ---------------------------------------------------------------- instruments
def kick():
    n = int(0.45 * SR)
    t = t_of(n)
    f = 45 + 110 * np.exp(-t / 0.045)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.28)
    click = hp(rng.standard_normal(n), 3000) * env(n, 0.0005, 0.004) * 0.4
    return np.tanh(1.6 * (x + click))


def snare():
    n = int(0.3 * SR)
    noise = bp(rng.standard_normal(n), 1200, 7000) * env(n, 0.001, 0.09)
    tone = np.sin(2 * np.pi * 185 * t_of(n)) * env(n, 0.001, 0.05)
    return 0.8 * noise + 0.5 * tone


def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    return hp(rng.standard_normal(n), 7000) * env(n, 0.0005, 0.09 if open_ else 0.018) * 0.35


def tom(freq):
    n = int(0.4 * SR)
    t = t_of(n)
    f = freq * (1 + 0.6 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.18)


def boom(size=1.0):
    """taiko / trailer impact: sub drop + body + noise crack"""
    n = int(2.4 * SR)
    t = t_of(n)
    f = 32 + 70 * np.exp(-t / 0.12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.002, 0.9 * size)
    body = lp(rng.standard_normal(n), 400) * env(n, 0.001, 0.12) * 1.5
    crack = bp(rng.standard_normal(n), 800, 6000) * env(n, 0.001, 0.05) * 0.6
    return np.tanh(1.4 * (sub + body + crack))


def crash():
    n = int(2.2 * SR)
    return hp(rng.standard_normal(n), 4000) * env(n, 0.001, 0.7) * 0.28


def brass(freqs, length):
    n = int(length * SR)
    x = sum(saw(f, n, 0.004) for f in freqs) / len(freqs)
    # brighter at the attack, darker as it sustains
    bright = lp(x, 3200)
    dark = lp(x, 900)
    e = env(n, 0.012, length * 0.45)
    mixw = np.exp(-t_of(n) / 0.12)
    return np.tanh(1.8 * (bright * mixw + dark * (1 - mixw))) * e


def pad(freqs, length):
    n = int(length * SR)
    x = sum(saw(f, n, 0.006) for f in freqs) / len(freqs)
    x = lp(x, 1400)
    t = t_of(n)
    e = np.clip(t / 0.6, 0, 1) * np.clip((length - t) / 0.4, 0, 1)
    return x * e


def bass_note(freq, length):
    n = int(length * SR)
    x = saw(freq, n) + 0.5 * saw(freq * 0.5, n)
    x = lp(x, 520)
    e = env(n, 0.003, length * 0.7)
    return np.tanh(2.5 * x) * e


def riser(length):
    n = int(length * SR)
    t = t_of(n)
    noise = rng.standard_normal(n)
    # sweep: blend progressively brighter filtered noise
    lo, mid, hi = lp(noise, 600), bp(noise, 600, 3000), hp(noise, 3000)
    k = t / length
    x = lo * (1 - k) + mid * np.sin(np.pi * k) + hi * k ** 2
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (3 * k)) / SR) * 0.25
    return (x * 0.5 + tone) * k ** 1.6


# ---------------------------------------------------------------- arrangement
def main():
    n_fighters = len(json.load(open(ROOT / "public" / "fighters.json")))
    end_t = TITLE + SEG * n_fighters
    total = end_t + END_SLAM + TAIL
    N = int(total * SR)
    dry = np.zeros((N, 2))
    verb = np.zeros((N, 2))

    def put(sig, at, gain=1.0, pan=0.0, send=0.0):
        i = int(at * SR)
        if i >= N:
            return
        s = sig[: N - i] * gain
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        dry[i : i + len(s), 0] += s * l
        dry[i : i + len(s), 1] += s * r
        if send:
            verb[i : i + len(s), 0] += s * l * send
            verb[i : i + len(s), 1] += s * r * send

    K, S, H, HO = kick(), snare(), hat(), hat(True)
    TOMS = [tom(f) for f in (140, 110, 85, 70)]

    # title: drone, slam, tension, riser into the first fighter
    put(pad([note("D2"), note("A2"), note("D3")], TITLE + 0.3), 0.0, 0.5, send=0.4)
    put(boom(1.3), TITLE_SLAM, 1.0, send=0.6)
    put(crash(), TITLE_SLAM, 0.8, send=0.3)
    put(brass([note("D3"), note("A3"), note("D4")], 1.4), TITLE_SLAM, 0.45, send=0.4)
    for i in range(8):  # ticking tension
        put(hat(), 1.2 + i * BEAT / 2, 0.5 + i * 0.05, pan=0.3 if i % 2 else -0.3)
    put(riser(TITLE - 1.0), 1.0, 0.55, send=0.2)

    prog = [("D", ["D3", "F3", "A3"]), ("Bb", ["Bb2", "D3", "F3"]), ("G", ["G2", "Bb2", "D3"]), ("A", ["A2", "C#3", "E3"])]
    ost = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 10, 0, 7, 0, 5, 3]  # 16th-note ostinato, semitones over the root

    for k in range(n_fighters):
        t0 = TITLE + k * SEG
        level = min(4, 1 + k // 8)  # energy steps up every 8 fighters
        root_name, chord = prog[k % 4]
        root = note(root_name + "1") if root_name != "Bb" else note("A#1")
        last = k == n_fighters - 1

        # downbeat impact for the fighter switch
        put(boom(1.0 if level < 3 else 1.2), t0, 0.85, send=0.5)
        put(crash(), t0, 0.5 + 0.1 * level, send=0.3)
        put(brass([note(c) for c in chord] + [note(chord[0][:-1] + str(int(chord[0][-1]) + 1))], 0.9), t0, 0.35 + 0.05 * level, send=0.35)

        for b in range(8):  # beats in the 2 bars
            tb = t0 + b * BEAT
            # kick: 1 and 3 of each bar, pushes with level
            if b % 4 in (0, 2) or (level >= 3 and b % 4 == 3):
                put(K, tb, 0.9)
            if level >= 2 and b % 2 == 1:
                put(K, tb + 2 * STEP, 0.55)
            # snare on 2 and 4
            if b % 4 in (1, 3):
                put(S, tb, 0.7, send=0.25)
            # hats
            subs = 4 if level >= 2 else 2
            for s in range(subs):
                put(HO if (s == subs - 1 and b % 2 == 1 and level >= 3) else H, tb + s * BEAT / subs, 0.45 if s % 2 == 0 else 0.3, pan=0.25)
        # tom fill at the end of the segment (not before the very first impact)
        if level >= 2 or k % 2 == 1:
            for i, tt in enumerate(TOMS):
                put(tt, t0 + 7 * BEAT + i * STEP, 0.55, pan=-0.4 + i * 0.25, send=0.2)

        # distorted bass ostinato
        for s in range(32):
            iv = ost[s % 16]
            if iv is None:
                continue
            put(bass_note(root * 2 ** (iv / 12), STEP * 0.95), t0 + s * STEP, 0.42)
        # high ostinato from level 3
        if level >= 3:
            for s in range(32):
                if s % 2 == 0:
                    f = note(chord[s // 2 % 3][:-1] + "5") if chord[s // 2 % 3][:-1] != "Bb" else note("A#5")
                    put(lp(saw(f, int(STEP * 1.6 * SR)), 2500) * env(int(STEP * 1.6 * SR), 0.002, 0.08), t0 + s * STEP, 0.12, pan=0.35, send=0.4)
        # pad from level 2
        if level >= 2:
            put(pad([note(c) for c in chord], SEG + 0.2), t0, 0.22, send=0.5)
        # riser into the final slam
        if last:
            put(riser(SEG), t0, 0.6, send=0.3)

    # final slam: ENTER THE TRENCHES
    te = end_t + END_SLAM
    put(boom(1.6), te, 1.1, send=0.7)
    put(crash(), te, 0.9, send=0.4)
    put(brass([note("D2"), note("A2"), note("D3"), note("F3"), note("A3")], 3.0), te, 0.6, send=0.5)
    put(pad([note("D2"), note("A2"), note("D3")], TAIL), te, 0.45, send=0.6)
    put(riser(END_SLAM), end_t, 0.4)

    # reverb: decaying noise impulse
    ir_n = int(2.0 * SR)
    ir = rng.standard_normal((ir_n, 2)) * np.exp(-t_of(ir_n) / 0.45)[:, None]
    ir = lp(ir.T, 5000).T * 0.03
    wet = np.stack([fftconvolve(verb[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
    mix = dry + wet
    mix = hp(mix.T, 28).T
    mix = np.tanh(1.2 * mix / np.max(np.abs(mix)) * 1.4)
    mix *= 0.93 / np.max(np.abs(mix))
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "intro.wav"
        wavfile.write(wav, SR, (mix * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "160k", str(OUT)], check=True)
    print(f"{OUT.relative_to(ROOT)}: {total:.1f}s for {n_fighters} fighters")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate the intro announcer: a deep, menacing voice saying every fighter's name.

Text-to-speech is Piper (https://github.com/rhasspy/piper) with the "Ryan (high)" US English
voice (dataset licence CC BY-NC-SA 4.0: fine for this non-commercial fan game, credited in the
README). Piper speaks slowly and steadily; ffmpeg then makes it deep and menacing (pitch down,
a growl an octave below, saturation, a dark reverb) while keeping the consonants clear.

Usage:
  python3 scripts/make_voices.py <piper-dir> <voice.onnx> [id ...]

  piper-dir:  the unpacked piper_linux_x86_64 release (contains the `piper` binary)
  voice.onnx: en-us-ryan-high.onnx from the piper v0.0.2 release

Writes public/assets/voice/<id>.mp3 and <id>-wins.mp3 for every fighter, the intro's title.mp3
and enter.mp3, and the fight announcer (round1-5, final, start, ko, draw, finish, fatality).
"""
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "voice"

# How each name should be spoken (written phonetically where the plain spelling misleads TTS)
SAY = {
    "promise-sol": "Promise Sol!",
    "onepeterr": "One Peter!",
    "unscripted": "Unscripted!",
    "king-sol": "King Sol!",
    "degenbro": "Degen Bro!",
    "juniordip": "Junior Dip!",
    "bloomstar": "Bloom Star!",
    "samuel-xeus": "Samuel Zeus!",
    "achillas": "Akillas!",
    "dami-defi": "Dahmee DeeFye!",
    "prudent-sammy": "Prudent Sammy!",
    "udy": "Oody!",
    "crypto-hak": "Crypto Hako!",
    "karo": "Kahro!",
    "illusions": "Ahmeen!",
    "fgs": "Shahlee!",
    "zaya": "Zaya!",
    "senpai": "Senpie!",
    "ugly-grm": "Ugly!",
    "one-random-guy": "Praise!",
    "seunn": "Sheyoon!",
    "echo": "Echo!",
    "salam": "Salahm!",
    "raviel": "Raviel!",
    "rex": "Rex!",
    "noir": "Nwar!",
    "rayan": "Rayan!",
    "yoshai": "Yoshy!",
    "crypto-baddie": "Crypto Baddie!",
    "arlecchino": "Arlekeeno!",
    "laka": "Lahka!",
    "skroot": "Skroot!",
    "otaobayom": "Otah Obahyom!",
    "gafar": "Gafar!",
    "nipherme": "Nifferm!",
    "limitlessdami": "Limitless Dahmee!",
    "zyloinsol": "Zylo in Sol!",
    "hundred": "Hundred!",
    "flipper": "Flipper!",
    "0xtochi": "Zero X Tochi!",
    "headboy": "Headboy!",
    "digitek": "Digitek!",
    "100x-arc": "Hundred X Arc!",
    "mystayor": "Mistayor!",
    "evansofweb3": "Evans of Web Three!",
    "codexbt": "Code X B T!",
    "swazy": "Swazee!",
    "rugway": "Rugway!",
    "hate": "Hate!",
    "xeverade": "Zeverade!",
}
EXTRA = {
    "title": "Trenches... Kombat!",
    "enter": "Enter the trenches.",
    # fight announcer
    "round1": "Round one!",
    "round2": "Round two!",
    "round3": "Round three!",
    "round4": "Round four!",
    "round5": "Round five!",
    "final": "Final round!",
    "start": "Start!",
    "ko": "Kay oh!",
    "draw": "Draw!",
    "finish": "Finish them!",
    "fatality": "Fatality!",
}

# Bold, scary and still clear:
#  - deep: ~6.5 semitones down in total. A small resample shift (x0.86) lowers pitch AND formants
#    a little, for a bigger, darker body; the rest is a formant-preserving pitch shift, so the
#    vowels keep their shape (shifting the formants all the way, as before, made words mushy).
#  - menace: a growl one octave below, low-passed under 800 Hz so it never covers consonants.
#  - bold: soft saturation and heavy compression.
#  - clear: a lift at 3.2 kHz (consonants), a cut at 450 Hz (mud), and a dark hall reverb with
#    25 ms of pre-delay in place of the old slap echo, so the words stay dry and on top.
FILTER = (
    "[0:a]apad=pad_dur=1.5,asetrate=22050*0.86,aresample=44100,"
    "rubberband=pitch=0.80:formant=preserved:transients=crisp,highpass=f=55,asplit=3[m][g][r];"
    "[g]rubberband=pitch=0.5:formant=preserved,lowpass=f=800,volume=0.25[gl];"
    "[r]volume=0.18[rin];[rin][1:a]afir=dry=0:wet=1[rv];"
    "[m][gl][rv]amix=inputs=3:duration=first:normalize=0,"
    "lowshelf=g=4:f=140,equalizer=f=450:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.1:g=4,"
    "volume=1.8,asoftclip=type=tanh,volume=0.556,"
    "acompressor=threshold=-22dB:ratio=5:attack=4:release=160,"
    "loudnorm=I=-11:TP=-1,aresample=44100,"
    # drop the padding again (keeping the reverb tail)
    "areverse,silenceremove=start_periods=1:start_threshold=-50dB,afade=t=in:d=0.03,areverse"
)


def make_ir(path: Path):
    """impulse response for the reverb: 1.6 s of dark, decaying noise after a 25 ms pre-delay"""
    sr = 44100
    t = np.arange(int(sr * 1.6)) / sr
    ir = np.random.default_rng(7).standard_normal(len(t)) * np.exp(-t / 0.38)
    ir = sosfilt(butter(2, 2500, "lp", fs=sr, output="sos"), ir)
    ir[: int(sr * 0.025)] = 0
    wavfile.write(str(path), sr, (ir / np.abs(ir).max() * 0.5).astype(np.float32))


# slow, steady delivery: longer phonemes, less random variation (the x0.86 resample above
# slows it a little more)
PIPER_ARGS = ["--length_scale", "1.75", "--noise_scale", "0.5", "--noise_w", "0.5", "--sentence_silence", "0.05"]


# Piper squeezes and clips a line that ends right after a short word ("Lahka!" came out in a
# quarter of a second, cut mid-vowel). So every line is spoken with a throwaway word after a
# comma, and the audio is cut in the pause before it: the line keeps its full length and ends
# on a natural decay.
CARRIER = ", go."


def last_pause(path: Path) -> float | None:
    """start (seconds) of the last pause of 80 ms or more inside the clip"""
    with wave.open(str(path)) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float)
    hop = sr // 100
    env = np.array([np.sqrt(np.mean(a[i : i + hop] ** 2)) for i in range(0, len(a) - hop, hop)])
    quiet = env < env.max() * 0.02
    found, i = None, 1
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if j - i >= 8 and j < len(quiet):
                found = i / 100
            i = j
        else:
            i += 1
    return found


def synth(piper: Path, model: Path, text: str, out: Path):
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.wav"
        subprocess.run(
            [str(piper / "piper"), "--model", str(model), *PIPER_ARGS, "--output_file", str(raw)],
            input=(text.rstrip("!.") + CARRIER).encode(),
            check=True,
            capture_output=True,
        )
        cut = last_pause(raw)
        if cut is None:
            raise SystemExit(f"no pause before the carrier word in {out.name}")
        ir = Path(td) / "ir.wav"
        make_ir(ir)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-t", f"{cut + 0.05:.2f}", "-i", str(raw), "-i", str(ir), "-filter_complex", FILTER, "-ac", "1", "-b:a", "80k", str(out)],
            check=True,
        )


def main():
    piper, model = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[3:])
    OUT.mkdir(parents=True, exist_ok=True)
    roster = json.load(open(ROOT / "public" / "fighters.json"))
    lines = {f["id"]: SAY.get(f["id"], f["name"] + "!") for f in roster}
    # "<name> wins!" for the end of each round
    lines.update({f"{k}-wins": v.rstrip("!.") + " wins!" for k, v in list(lines.items())})
    lines.update(EXTRA)
    for key, text in lines.items():
        if only and key not in only:
            continue
        synth(piper, model, text, OUT / f"{key}.mp3")
        print(key, text)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate the intro announcer: a deep, menacing voice saying every fighter's name.

Text-to-speech is Piper (https://github.com/rhasspy/piper) with the "Ryan (high)" US English
voice (dataset licence CC BY-NC-SA 4.0: fine for this non-commercial fan game, credited in the
README). The voice is then pitched down, layered with a sub-octave copy, compressed and given a
short echo with ffmpeg.

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
from pathlib import Path

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
    "ko": "K. O.!",
    "draw": "Draw!",
    "finish": "Finish them!",
    "fatality": "Fatality!",
}

# pitch down ~7 semitones, keep it slow and heavy, add a quiet sub-octave layer and a short echo
FILTER = (
    "[0:a]apad=pad_dur=1,asetrate=22050*0.66,aresample=44100,atempo=1.18,asplit=2[main][sub];"
    "[sub]asetrate=44100*0.82,aresample=44100,atempo=1.22,volume=0.35,lowpass=f=900[subl];"
    "[main][subl]amix=inputs=2:duration=first:normalize=0,"
    "lowshelf=g=5:f=110,equalizer=f=2800:t=q:w=1.2:g=-4,"
    "acompressor=threshold=-22dB:ratio=5:attack=4:release=140,"
    "aecho=0.8:0.55:70|160:0.3|0.16,"
    "loudnorm=I=-11:TP=-1,aresample=44100,"
    # drop the padding again (keeping the echo tail)
    "areverse,silenceremove=start_periods=1:start_threshold=-48dB,afade=t=in:d=0.03,areverse"
)


def synth(piper: Path, model: Path, text: str, out: Path):
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.wav"
        subprocess.run(
            [str(piper / "piper"), "--model", str(model), "--length_scale", "1.3", "--sentence_silence", "0.05", "--output_file", str(raw)],
            input=text.encode(),
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-filter_complex", FILTER, "-ac", "1", "-b:a", "64k", str(out)],
            check=True,
        )


def main():
    piper, model = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[3:])
    OUT.mkdir(parents=True, exist_ok=True)
    roster = json.load(open(ROOT / "public" / "fighters.json"))
    lines = {f["id"]: SAY.get(f["id"], f["name"] + "!") for f in roster}
    # "<name> wins!" for the end of each round
    lines.update({f"{k}-wins": v.rstrip("!") + " wins!" for k, v in list(lines.items())})
    lines.update(EXTRA)
    for key, text in lines.items():
        if only and key not in only:
            continue
        synth(piper, model, text, OUT / f"{key}.mp3")
        print(key, text)


if __name__ == "__main__":
    main()

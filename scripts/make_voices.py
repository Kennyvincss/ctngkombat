#!/usr/bin/env python3
"""Generate the announcer: one deep, steady, bold voice saying every fighter's name and the
fight calls.

Text-to-speech is Piper (https://github.com/rhasspy/piper) with its LibriTTS (high) US English
model, speaker 436 (dataset: LibriTTS, CC BY 4.0, credited in the README). The voice is kept a
single voice, with no doubled or octave layers (those sounded like auto-tune):
  1. Piper speaks the line slowly and steadily.
  2. Praat (via parselmouth) moves the pitch down to ~70 Hz and flattens most of its rise and
     fall (PSOLA keeps the vowels and consonants clear), like a movie-trailer announcer.
  3. ffmpeg makes it bold: a heavier low end, light saturation, hard compression, a short room.

Usage:
  pip install praat-parselmouth
  python3 scripts/make_voices.py <piper-dir> <libritts.onnx> [id ...]

  piper-dir:     the unpacked piper_linux_x86_64 release (contains the `piper` binary)
  libritts.onnx: en-us-libritts-high.onnx from the piper v0.0.2 release (voice-en-us-libritts-high)

Writes public/assets/voice/<id>.mp3 and <id>-wins.mp3 for every fighter, the intro's title.mp3
and enter.mp3, and the fight announcer (round1-5, final, start, ko, draw, finish, fatality).
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import parselmouth
from parselmouth.praat import call

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "voice"

# How each name should be spoken (written phonetically where the plain spelling misleads TTS)
SAY = {
    "promise-sol": "Promise Sol!",
    "onepeterr": "One Peter!",
    "arlecchino": "Arlekeeno!",
    "skroot": "Skroot!",
    "mystayor": "My stay or!",
    # batch 5
    "cupsey": "Cupsey!",
    "cented": "Sented!",
    "tekkers": "Tekkers!",
    "dior": "Dior!",
    "poorgoat": "Poor goat!",
    "otta": "Otta!",
    "unipcs": "Uni P C S!",
    "heat": "Heat!",
    "dylaneth": "Dylan eth!",
    "midtermdev": "Midterm dev!",
    "alon": "Alon!",
    "ansem": "Ansem!",
    "seyong": "Say yong!",
    "ethan-prosper": "Ethan Prosper!",
    "orangie": "Orangie!",
    "kimchi": "Kimchi!",
    "lynk": "Link!",
    "sling": "Sling!",
    "daumen": "Dow men!",
    "yenni": "Yenni!",
    "jack-duval": "Jack Duval!",
    "smokez": "Smokes!",
    "rektober": "Rek tober!",
    "marcell": "Marcell!",
    "imsheepsol": "I am sheep sol!",
    "chairman": "Chairman!",
    "the-detective": "The Detective!",
    "the-solstice": "The Solstice!",
    "appie": "Appie!",
    "scharo": "Sharo!",
    "pattyice": "Patty ice!",
    "bancrypto": "Ban crypto!",
    "latuche": "La tush!",
    "dani-worldwide": "Dani Worldwide!",
    "realist": "Realist!",
    "cap100x": "Cap one hundred X!",
    "sanity100x": "Sanity one hundred X!",
    "deecayz": "Dee kays!",
    "solana-dave": "Solana Dave!",
    # end batch 5
    "evansofweb3": "Evans of Web Three!",
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

SPEAKER = 436
PITCH_HZ = 70          # where the voice sits
KEEP = 0.25            # how much of its natural rise and fall is kept (0 = a flat monotone)
PIPER_ARGS = ["--speaker", str(SPEAKER), "--length_scale", "1.65", "--noise_scale", "0.5", "--noise_w", "0.4", "--sentence_silence", "0.3"]

# bold: a heavier body, a cut in the boxy mids, presence for the consonants, light saturation
# for grit, hard compression so every word hits, a short room
FILTER = (
    "apad=pad_dur=1.2,aresample=44100,atempo=0.92,highpass=f=50,"
    "lowshelf=g=6:f=115,equalizer=f=340:t=q:w=1.2:g=-3,equalizer=f=2600:t=q:w=1:g=4,highshelf=g=1.5:f=6500,"
    "acompressor=threshold=-28dB:ratio=8:attack=2:release=110:makeup=2,"
    "volume=1.9,asoftclip=type=tanh,volume=0.62,"
    "aecho=0.85:0.22:26|44:0.16|0.08,"
    "acompressor=threshold=-14dB:ratio=4:attack=1:release=80,"
    "loudnorm=I=-11:TP=-0.8,aresample=44100,"
    # trim the silence at both ends (keeping the room tail)
    "areverse,silenceremove=start_periods=1:start_threshold=-55dB,afade=t=in:d=0.04,areverse,"
    "silenceremove=start_periods=1:start_threshold=-55dB"
)


def steady(src: Path, out: Path):
    """PSOLA: move the pitch to PITCH_HZ and keep only KEEP of its rise and fall (one voice)"""
    snd = parselmouth.Sound(str(src))
    manip = call(snd, "To Manipulation", 0.01, 50, 300)
    tier = call(manip, "Extract pitch tier")
    median = call(snd.to_pitch(), "Get quantile", 0, 0, 0.5, "Hertz")
    call(tier, "Formula", f"{PITCH_HZ} * (self / {median}) ^ {KEEP}")
    call([tier, manip], "Replace pitch tier")
    res = call(manip, "Get resynthesis (overlap-add)")
    res.scale_peak(0.95)
    res.save(str(out), "WAV")


def synth(piper: Path, model: Path, text: str, out: Path):
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.wav"
        flat = Path(td) / "flat.wav"
        subprocess.run([str(piper / "piper"), "--model", str(model), *PIPER_ARGS, "--output_file", str(raw)], input=text.encode(), check=True, capture_output=True)
        steady(raw, flat)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(flat), "-af", FILTER, "-ac", "1", "-b:a", "96k", str(out)], check=True)


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

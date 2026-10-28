#!/usr/bin/env python3
"""Add a background music bed and sound effects to a rendered edit.

  mix.py OUTDIR SPEC.json MUSIC.mp3 SFX_DIR [OUT.mp4]

OUTDIR is an edit.py output folder (final.mp4, cues.json, plan.json). The music loops for the
whole video, ducks under speech (sidechain on the voice) and lifts on the end card. Sound effects
are placed from the cue sheet: pop on name tags / question cards, rise on titles, hit on snap
zooms, whoosh on card zoom-outs, cutaways and speaker changes, chime on the end card.
SFX_DIR holds whoosh.mp3, pop.mp3, rise.mp3, hit.mp3, chime.mp3.
"""
import json
import os
import subprocess
import sys

SFX_FOR = {"name": ("pop", 0.05, -9), "question": ("pop", 0.05, -8), "title": ("rise", -0.25, -9),
           "snap": ("hit", -0.02, -8), "card": ("whoosh", -0.05, -10), "endcard": ("chime", 0.25, -7)}


def at_fn(plan):
    def at(clip, t):
        cands = [p for p in plan if p["clip"] == str(clip)]
        for p in cands:
            if p["a"] <= t <= p["b"]:
                return p["o"] + t - p["a"]
        later = [p for p in cands if p["a"] > t]
        return later[0]["o"] if later else 0
    return at


def events(outdir, spec):
    cues = json.load(open(os.path.join(outdir, "cues.json")))["cues"]
    meta = json.load(open(os.path.join(outdir, "plan.json")))
    at = at_fn(meta["plan"])
    ev = []
    for c in cues:
        if c["fx"] in SFX_FOR:
            name, off, gain = SFX_FOR[c["fx"]]
            ev.append((max(c["start"] + off, 0), name, gain))
    for cw in spec.get("cutaways", []):
        ev.append((max(at(*cw["at"]) + cw.get("offset", 0) - 0.12, 0), "whoosh", -12))
    for a, _ in meta["segments"][1:]:
        ev.append((max(a - 0.2, 0), "whoosh", -11))
    ev.sort()
    out = []
    for e in ev:  # never stack two effects closer than 0.35 s
        if not out or e[0] - out[-1][0] > 0.35:
            out.append(e)
    return out, meta["speech_end"]


def mix(outdir, spec, music, sfx_dir, out=None):
    src = os.path.join(outdir, "final.mp4")
    out = out or os.path.join(outdir, "final-music.mp4")
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                               capture_output=True, text=True).stdout)
    ev, speech_end = events(outdir, spec)
    level = spec.get("music_level", -21)
    args = ["ffmpeg", "-v", "error", "-y", "-i", src, "-stream_loop", "-1", "-i", music]
    fc = ["[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[voice][key]",
          f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration={dur:.3f},asetpts=PTS-STARTPTS,"
          f"loudnorm=I={level}:TP=-6:LRA=11,afade=t=in:d=1.2,afade=t=out:st={dur - 1.6:.3f}:d=1.6[bed]",
          "[bed][key]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600:makeup=1,"
          f"volume='if(gte(t,{speech_end + 0.2:.2f}),1.6,1)':eval=frame[duck]"]
    mixins = ["[voice]", "[duck]"]
    for i, (t, name, gain) in enumerate(ev):
        args += ["-i", os.path.join(sfx_dir, name + ".mp3")]
        ms = int(t * 1000)
        fc.append(f"[{i + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={gain}dB,"
                  f"adelay={ms}|{ms}[s{i}]")
        mixins.append(f"[s{i}]")
    fc.append("".join(mixins) + f"amix=inputs={len(mixins)}:duration=first:normalize=0,"
              "loudnorm=I=-14:TP=-1.5:LRA=11,aformat=sample_rates=48000[aout]")
    args += ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[aout]", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "192k", "-t", f"{dur:.3f}", "-movflags", "+faststart", out]
    subprocess.run(args, check=True)
    print(f"{out}: music + {len(ev)} sound effects")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(1)
    mix(sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)

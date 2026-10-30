#!/usr/bin/env python3
"""Transcript-driven cutter for interview / testimony videos.

  edit.py SPEC.json OUTDIR [--render]

Reads word timestamps (ElevenLabs Scribe JSON, one file per clip), keeps the chosen ranges,
drops fillers ("uh", "aa", "err"...) and long pauses, hides jump cuts with alternating
punch-ins, adds full-screen B-roll cutaways (speaker audio keeps running underneath), a
white dip between speakers, and holds the last frame for the end card. Writes:

  OUTDIR/cut.mp4     the cut, 1080x1920 30 fps
  OUTDIR/cues.json   fx.py cue sheet: word-timed subtitles + spec cues mapped to the new timeline
  OUTDIR/final.mp4   with --render: fx.py render of the two
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
FILLERS = {"uh", "um", "umm", "ah", "aa", "aaa", "err", "erm", "em", "eh", "hmm", "mm", "ehm"}
PRE, POST, MAXGAP = 0.10, 0.16, 0.42


def norm(w):
    return re.sub(r"[^\w-]", "", w.lower())


def load_words(tx_dir, clip):
    j = json.load(open(os.path.join(tx_dir, f"{clip}.json")))
    return [{"w": w["text"], "s": w["start"], "e": w["end"]} for w in j["words"] if w["type"] == "word"]


def correct(words, phrases):
    """Apply phrase corrections, e.g. [["jo", "korad"], "JOMKORA"]; keeps trailing punctuation."""
    out, i = [], 0
    while i < len(words):
        for src, dst in phrases:
            n = len(src)
            if [norm(w["w"]) for w in words[i:i + n]] == src:
                tail = re.sub(r"^.*?([.,!?]*)$", r"\1", words[i + n - 1]["w"])
                if dst:
                    out.append({"w": dst + tail, "s": words[i]["s"], "e": words[i + n - 1]["e"]})
                i += n
                break
        else:
            out.append(words[i])
            i += 1
    return out


def intervals(seg, words):
    """Kept source intervals for one segment."""
    skip = seg.get("skip", [])
    inside = lambda t: any(a <= t <= b for a, b in skip)
    ws = [w for w in words if seg["from"] <= w["s"] < seg["to"]]
    keep = [w for w in ws if norm(w["w"]) not in FILLERS and not inside(w["s"])]
    if not keep:
        return [], []
    ivs, cur = [], [max(seg["from"], keep[0]["s"] - PRE), keep[0]["e"]]
    for prev, w in zip(keep, keep[1:]):
        dropped = any(prev["s"] < x["s"] < w["s"] for x in ws if x not in keep)
        if w["s"] - prev["e"] > MAXGAP or dropped:
            cur[1] = prev["e"] + POST
            ivs.append(cur)
            cur = [w["s"] - PRE, w["e"]]
        else:
            cur[1] = w["e"]
    cur[1] = min(seg["to"], cur[1] + POST)
    ivs.append(cur)
    merged = []
    for a, b in ivs:
        if merged and a - merged[-1][1] < 0.06:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return merged, keep


def build(spec, outdir, render=False):
    os.makedirs(outdir, exist_ok=True)
    tx, hq = spec["tx_dir"], spec["hq_dir"]
    phrases = [([norm(x) for x in k.split()], v) for k, v in spec.get("corrections", {}).items()]
    plan, subs, t_out = [], [], 0.0
    seg_marks = []
    for si, seg in enumerate(spec["segments"]):
        words = load_words(tx, seg["clip"])
        ivs, keep = intervals(seg, words)
        seg_start = t_out
        for k, (a, b) in enumerate(ivs):
            gap_before = a - ivs[k - 1][1] if k else 0
            punch = seg.get("punch", True) and k > 0 and gap_before > 0.25
            plan.append({"clip": seg["clip"], "a": a, "b": b, "o": t_out, "seg": si,
                         "zoom": 1.0, "dip_in": si > 0 and k == 0 and spec.get("dip", True),
                         "dip_out": si < len(spec["segments"]) - 1 and k == len(ivs) - 1 and spec.get("dip", True),
                         "punch": punch})
            t_out += b - a
        # alternate punch-in on every hidden cut inside a segment
        base, tight = seg.get("zoom", 1.0), False
        for p in plan:
            if p["seg"] == si:
                if p["punch"]:
                    tight = not tight
                p["zoom"] = base * (seg.get("punch_scale", 1.08) if tight else 1.0)
        first = True
        for w in ([] if seg.get("nosubs") else correct(keep, phrases)):
            for p in plan:
                if p["seg"] == si and p["a"] <= w["s"] < p["b"]:
                    subs.append({"w": w["w"].replace(",", ""), "s": round(w["s"] - p["a"] + p["o"], 3),
                                 "e": round(min(w["e"], p["b"]) - p["a"] + p["o"], 3)})
                    if first:
                        subs[-1]["brk"] = True  # subtitles never run across a segment change
                        first = False
                    break
        seg_marks.append((seg_start, t_out))
    speech_end = t_out
    tail = spec.get("tail", 3.4)

    def at(clip, t):
        """Map a source time on a clip to the output timeline."""
        cands = [p for p in plan if p["clip"] == str(clip)]
        for p in cands:
            if p["a"] <= t <= p["b"]:
                return p["o"] + t - p["a"]
        later = [p for p in cands if p["a"] > t]
        return later[0]["o"] if later else (cands[-1]["o"] + cands[-1]["b"] - cands[-1]["a"] if cands else 0)

    # ---- ffmpeg: cut + punch + dips + cutaways + tail hold
    args, fc = ["ffmpeg", "-v", "error", "-y"], []
    for i, p in enumerate(plan):
        d = p["b"] - p["a"]
        args += ["-ss", f"{p['a']:.3f}", "-t", f"{d:.3f}", "-i", os.path.join(hq, f"{p['clip']}.mp4")]
        z = p["zoom"]
        fy = spec.get("punch_center", 0.40)
        v = (f"[{i}:v]crop=iw/{z}:ih/{z}:(iw-iw/{z})/2:(ih-ih/{z})*{fy},scale={W}:{H}:flags=lanczos,setsar=1,"
             f"fps={FPS},trim=duration={d:.3f},setpts=PTS-STARTPTS")
        if p["dip_in"]:
            v += ",fade=t=in:st=0:d=0.18:color=white"
        if p["dip_out"]:
            v += f",fade=t=out:st={max(d - 0.18, 0):.3f}:d=0.18:color=white"
        fc.append(v + f"[v{i}]")
        fc.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=duration={d:.3f},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.02,afade=t=out:st={max(d - 0.035, 0):.3f}:d=0.035[a{i}]")
    n = len(plan)
    fc.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[cv][ca]")
    fc.append(f"[cv]tpad=stop_mode=clone:stop_duration={tail}[base0]")
    fc.append(f"[ca]apad=pad_dur={tail}[aout]")
    last = "base0"
    for k, cw in enumerate(spec.get("cutaways", [])):
        idx = n + k
        t0 = at(*cw["at"]) + cw.get("offset", 0)
        d = cw.get("dur", 2.0)
        args += ["-ss", f"{cw.get('ss', 0):.3f}", "-t", f"{d + 0.2:.3f}", "-i", cw["file"]]
        fc.append(f"[{idx}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps={FPS},"
                  f"format=yuva420p,trim=duration={d:.3f},fade=t=in:st=0:d=0.14:alpha=1,"
                  f"fade=t=out:st={d - 0.14:.3f}:d=0.14:alpha=1,setpts=PTS-STARTPTS+{t0:.3f}/TB[cw{k}]")
        fc.append(f"[{last}][cw{k}]overlay=eof_action=pass:enable='between(t,{t0:.3f},{t0 + d:.3f})'[base{k + 1}]")
        last = f"base{k + 1}"
    cut = os.path.join(outdir, "cut.mp4")
    args += ["-filter_complex", ";".join(fc), "-map", f"[{last}]", "-map", "[aout]",
             "-t", f"{speech_end + tail:.3f}", "-c:v", "libx264", "-preset", "fast", "-crf", "15",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", cut]
    subprocess.run(args, check=True)

    # ---- cue sheet
    cfg = {k: v for k, v in spec.get("look", {}).items()}
    cfg.setdefault("face", [0.5, 0.40])
    cues = []
    if spec.get("subs"):
        cues.append(dict(spec["subs"], fx="subs", start=0, end=speech_end + 0.3, words=subs))
    for c in spec.get("cues", []):
        c = dict(c)
        if "at" in c:
            c["start"] = round(at(*c.pop("at")) + c.pop("offset", 0), 3)
        elif "seg" in c:
            c["start"] = round(seg_marks[c.pop("seg")][0] + c.pop("offset", 0.3), 3)
        if "until" in c:
            c["end"] = round(at(*c.pop("until")), 3)
        elif "until_seg_end" in c:
            c["end"] = round(seg_marks[c.pop("until_seg_end")][1] - 0.1, 3)
        else:
            c["end"] = round(c["start"] + c.pop("dur", 2.0), 3)
        cues.append(c)
    if spec.get("endcard"):
        cues.append(dict(spec["endcard"], fx="endcard", start=round(speech_end + 0.15, 3)))
    cfg["cues"] = cues
    json.dump(cfg, open(os.path.join(outdir, "cues.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"speech_end": speech_end, "segments": seg_marks, "plan": plan},
              open(os.path.join(outdir, "plan.json"), "w"), indent=1)
    print(f"{spec.get('name', outdir)}: {len(plan)} shots, {speech_end:.1f}s speech + {tail}s end card")
    if render:
        subprocess.run([sys.executable, os.path.join(HERE, "fx.py"), "render", cut,
                        os.path.join(outdir, "cues.json"), os.path.join(outdir, "final.mp4")], check=True)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    build(json.load(open(sys.argv[1])), sys.argv[2], "--render" in sys.argv)

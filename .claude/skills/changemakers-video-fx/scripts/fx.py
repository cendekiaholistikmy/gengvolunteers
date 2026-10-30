#!/usr/bin/env python3
"""Changemakers Lab video FX renderer (ffmpeg + Pillow, no templates).

Takes a vertical talking-head / event clip plus a cue sheet (JSON) and burns in
branded motion graphics in the Changemakers Lab 1.0/2026 JOMKORA palette.

  fx.py render  INPUT.mp4 CUES.json OUT.mp4        full 1080x1920 30fps render
  fx.py preview INPUT.mp4 CUES.json OUTDIR          one still per cue (check before render)
  fx.py compare INPUT.mp4 TIME OUT.png              natural / hype / heart grade side by side
  fx.py sheet   OUT.png IMG [IMG ...]               contact sheet from preview stills
  fx.py standin OUT.mp4 [SECONDS]                   synthetic test clip (no real person)

Cue times are seconds on the (already cut) clip. See ../SKILL.md for every cue.
"""
import json
import math
import os
import re
import subprocess
import sys
import wave
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
PAL = json.load(open(os.path.join(SKILL, "palette.json")))
W, H, FPS = 1080, 1920, 30
SR = 48000


# ---------------------------------------------------------------- basics

def rgba(name, a=255):
    h = PAL["colors"].get(name, {"hex": name})["hex"].lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    """Cubic in-out: slow, fast, slow."""
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def back(x, s=1.6):
    """Ease-out with a small overshoot (the 'little bounce')."""
    x = clamp(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def envelope(t, c, fin=0.35, fout=0.35):
    if t < c["start"] or t > c["end"]:
        return 0.0
    a = ease((t - c["start"]) / fin) if fin > 0 else 1.0
    b = ease((c["end"] - t) / fout) if fout > 0 else 1.0
    return min(a, b)


_FONT_INDEX = None


def _font_index():
    global _FONT_INDEX
    if _FONT_INDEX is None:
        _FONT_INDEX = {}
        roots = ["/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts"),
                 "/System/Library/Fonts", "/Library/Fonts", os.path.expanduser("~/Library/Fonts"),
                 "C:/Windows/Fonts"]
        for root in roots:
            for dp, _, files in os.walk(root):
                for f in files:
                    if f.lower().endswith((".ttf", ".otf")):
                        _FONT_INDEX.setdefault(os.path.splitext(f)[0].lower(), os.path.join(dp, f))
    return _FONT_INDEX


WEIGHTS = {
    "black": ["inter-black", "interdisplay-black", "inter-extrabold", "montserrat-black", "ariblk", "dejavusans-bold"],
    "bold": ["inter-bold", "interdisplay-bold", "montserrat-bold", "arialbd", "dejavusans-bold"],
    "semi": ["inter-semibold", "interdisplay-semibold", "montserrat-semibold", "arial", "dejavusans"],
    "regular": ["inter-regular", "inter", "montserrat-regular", "arial", "dejavusans"],
}


@lru_cache(None)
def font(weight, size):
    idx = _font_index()
    for name in WEIGHTS[weight]:
        if name in idx:
            return ImageFont.truetype(idx[name], size)
    return ImageFont.load_default(size)


def mood(cfg):
    return PAL["moods"][cfg.get("mood", "hype")]


def acc(cfg, key="accent", a=255):
    return rgba(mood(cfg)[key], a)


# ---------------------------------------------------------------- sprite helpers

def put(frame, spr, x, y, scale=1.0, alpha=1.0, anchor=(0.5, 0.5), rot=0.0):
    """Alpha-composite sprite onto frame (RGBA) at (x, y) with transform, clipped to frame."""
    if alpha <= 0.01 or scale <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.BICUBIC)
    if rot:
        spr = spr.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 0.999:
        spr = spr.copy()
        spr.putalpha(spr.getchannel("A").point(lambda v: int(v * alpha)))
    px, py = int(x - spr.width * anchor[0]), int(y - spr.height * anchor[1])
    sx, sy = max(-px, 0), max(-py, 0)
    dx, dy = max(px, 0), max(py, 0)
    w, h = min(spr.width - sx, frame.width - dx), min(spr.height - sy, frame.height - dy)
    if w > 0 and h > 0:
        frame.alpha_composite(spr, dest=(dx, dy), source=(sx, sy, sx + w, sy + h))


def hgrad(w, h, c1, c2):
    a = np.linspace(0, 1, w)[None, :, None]
    arr = np.array(c1, float)[None, None, :] * (1 - a) + np.array(c2, float)[None, None, :] * a
    return Image.fromarray(np.repeat(arr, h, 0).astype(np.uint8), "RGBA")


@lru_cache(64)
def rmask(w, h, r):
    """Anti-aliased rounded-rect mask (drawn at 3x)."""
    m = Image.new("L", (w * 3, h * 3), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 3 - 1, h * 3 - 1), r * 3, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def rrect(w, h, r, fill, grad=None):
    base = hgrad(w, h, *grad) if grad else Image.new("RGBA", (w, h), fill)
    m = rmask(w, h, r)
    if base.mode == "RGBA":
        m = Image.fromarray((np.asarray(m, float) * np.asarray(base.getchannel("A"), float) / 255).astype(np.uint8))
    base.putalpha(m)
    return base


@lru_cache(32)
def shadow(w, h, r, spread=40, a=150):
    s = Image.new("RGBA", (w + spread * 2, h + spread * 2), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((spread, spread + 12, spread + w, spread + h + 12), r, fill=(0, 0, 0, a))
    return s.filter(ImageFilter.GaussianBlur(spread / 2.5))


@lru_cache(16)
def halo(r, color):
    s = Image.new("RGBA", (r * 4, r * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    d.ellipse((r, r, r * 3, r * 3), fill=color[:3] + (200,))
    s = s.filter(ImageFilter.GaussianBlur(r * 0.6))
    ImageDraw.Draw(s).ellipse((r * 1.6, r * 1.6, r * 2.4, r * 2.4), fill=(255, 255, 255, 255))
    return s


def wrap(text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if f.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


@lru_cache(8)
def logo(name, maxw, maxh):
    im = Image.open(os.path.join(SKILL, "assets", name)).convert("RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((maxw, maxh), Image.LANCZOS)
    return im


def blurred_bg(img, dark=0.55, zoom=1.08):
    small = img.resize((W // 12, H // 12), Image.BILINEAR).filter(ImageFilter.GaussianBlur(2.5))
    cw, ch = int(small.width / zoom), int(small.height / zoom)
    l, t = (small.width - cw) // 2, (small.height - ch) // 2
    bg = small.crop((l, t, l + cw, t + ch)).resize((W, H), Image.BICUBIC)
    return ImageEnhance.Brightness(bg).enhance(dark)


# ---------------------------------------------------------------- camera (zoom / card / snap / lift)

def affine(img, s, ax, ay):
    if abs(s - 1) < 1e-4:
        return img
    k = 1 / s
    return img.transform((W, H), Image.AFFINE, (k, 0, ax * (1 - k), 0, k, ay * (1 - k)), Image.BILINEAR)


def camera(img, t, cfg):
    fx_, fy_ = cfg.get("face", [0.5, 0.36])
    ax, ay = fx_ * W, fy_ * H
    zoom, lift, card, blur = 1.0, 1.0, None, 0.0
    for c in cfg["cues"]:
        if not (c["start"] <= t <= c["end"]):
            continue
        f = c["fx"]
        if f == "zoom":
            zoom *= 1 + (c.get("scale", 1.2) - 1) * envelope(t, c, 0.6, 0.6)
        elif f == "card":
            card = 1 - (1 - c.get("scale", 0.8)) * envelope(t, c, 0.6, 0.6)
        elif f == "snap":
            n = c.get("frames", 4) / FPS
            sc, k, r = c.get("scale", 1.45), t - c["start"], c["end"] - t
            hold = sc * (1 + 0.04 * clamp((k - n) / max(c["end"] - c["start"] - 2 * n, 0.1)))
            if k < n:
                zoom *= 1 + (sc - 1) * ease(k / n)
                blur = 1.0
            elif r < n:
                zoom *= 1 + (hold - 1) * ease(r / n)
                blur = 1.0
            else:
                zoom *= hold
        elif f in ("checklist", "growth", "broll") and c.get("lift", True):
            lift = max(lift, 1 + c.get("lift_amount", 0.10) * envelope(t, c, 0.5, 0.5))
    if lift > 1:  # zoom anchored at the bottom edge = face moves up, card gets room under the chin
        img = affine(img, lift, ax, H)
    if blur:
        layers = [affine(img, zoom * m, ax, ay) for m in (1.0, 0.965, 0.93)]
        img = Image.blend(Image.blend(layers[2], layers[1], 0.5), layers[0], 0.45)
    else:
        img = affine(img, zoom, ax, ay)
    if card is not None and card < 0.999:
        bg = blurred_bg(img).convert("RGBA")
        fw, fh = int(W * card), int(H * card)
        r = int(70 * clamp((1 - card) / 0.2))
        fg = img.resize((fw, fh), Image.BILINEAR).convert("RGBA")
        fg.putalpha(rmask(fw, fh, max(r, 1)))
        put(bg, shadow(fw, fh, max(r, 1)), W / 2, H / 2 + 4)
        put(bg, fg, W / 2, H / 2)
        img = bg.convert("RGB")
    return img


# ---------------------------------------------------------------- overlays

@lru_cache(4)
def brand_pill(text, sub, accent):
    f1, f2 = font("bold", 30), font("semi", 30)
    tw = f1.getlength(text) + f2.getlength("  ·  " + sub)
    w, h = int(tw + 110), 66
    spr = rrect(w, h, h // 2, rgba("navy", 215))
    d = ImageDraw.Draw(spr)
    cx, cy, r = 40, h // 2, 11
    star = [(cx + (r if i % 2 == 0 else r * 0.42) * math.cos(math.pi / 2 + i * math.pi / 5),
             cy - (r if i % 2 == 0 else r * 0.42) * math.sin(math.pi / 2 + i * math.pi / 5)) for i in range(10)]
    d.polygon(star, fill=rgba("gold"))
    d.text((64, h / 2), text, font=f1, fill=rgba("chalk"), anchor="lm")
    d.text((64 + f1.getlength(text), h / 2), "  ·  " + sub, font=f2, fill=accent, anchor="lm")
    return spr


def fx_brand(fr, t, cfg, ctx):
    b = cfg.get("brand")
    if not b:
        return
    end = ctx["duration"] - (ctx.get("endcard_len") or 0)
    a = ease(t / 0.6) * ease((end - t) / 0.4)
    put(fr, brand_pill(b.get("text", "CHANGEMAKERS LAB 1.0/2026"), b.get("sub", "JOMKORA EDITION"), acc(cfg)),
        W / 2, 96 - 20 * (1 - a), alpha=a)
    p = clamp(t / max(end, 0.1))
    if p > 0 and a > 0:
        bar = hgrad(max(1, int(W * p)), 8, acc(cfg), acc(cfg, "accent3"))
        put(fr, bar, 0, 0, anchor=(0, 0), alpha=a)


@lru_cache(512)
def glyph(ch, size, fill, stroke):
    f = font("black", size)
    l, tp, r, b = f.getbbox(ch, stroke_width=stroke)
    im = Image.new("RGBA", (max(1, r - l + 8), max(1, b - tp + 8)), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((4 - l, 4 - tp), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=rgba("night", 230))
    return im, l - 4, tp - 4


def fx_title(fr, t, c, cfg):
    text = c["text"].upper()
    size = c.get("size", 190)
    while font("black", size).getlength(text) > W - 120 and size > 60:
        size -= 6
    f = font("black", size)
    cy = c.get("y", 0.13) * H
    x0 = (W - f.getlength(text)) / 2
    out = ease((c["end"] - t) / 0.35)
    for i, ch in enumerate(text):
        if ch == " ":
            continue
        p = ease((t - c["start"] - i * 0.045) / 0.35)
        if p <= 0:
            continue
        g, ox, oy = glyph(ch, size, rgba("chalk"), max(3, size // 40))
        x = x0 + f.getlength(text[:i]) + ox
        y = cy - size * 0.5 + oy + 40 * (1 - p) - 30 * (1 - out)
        put(fr, g, x, y, anchor=(0, 0), alpha=p * out)
    if c.get("sub"):
        p = ease((t - c["start"] - 0.35 - len(text) * 0.045) / 0.35) * out
        sf = font("bold", 46)
        sw = int(sf.getlength(c["sub"].upper())) + 60
        pill = rrect(sw, 72, 36, None, grad=(acc(cfg, "accent2"), acc(cfg, "accent3")))
        ImageDraw.Draw(pill).text((sw / 2, 36), c["sub"].upper(), font=sf, fill=rgba("chalk"), anchor="mm")
        put(fr, pill, W / 2, cy + size * 0.5 + 72 + 20 * (1 - p), alpha=p)


@lru_cache(128)
def bubble(text, side, mood_name, size=38, maxw=620):
    f = font("semi", size)
    lines = wrap(text, f, maxw - 56)
    lh = int(size * 1.28)
    w = int(max(f.getlength(l) for l in lines)) + 56
    h = lh * len(lines) + 36
    m = PAL["moods"][mood_name]
    tail = 16
    canvas = Image.new("RGBA", (w + tail, h), (0, 0, 0, 0))
    if side == "r":
        body = rrect(w, h, 34, None, grad=(rgba(m["accent2"]), rgba(m["accent3"]))) if mood_name == "hype" \
            else rrect(w, h, 34, rgba(m["accent"]))
        tcol, bx = rgba("chalk"), 0
        tail_poly = [(w - 30, h - 26), (w + tail, h), (w - 44, h - 2)]
        tail_col = rgba(m["accent3"] if mood_name == "hype" else m["accent"])
    else:
        body = rrect(w, h, 34, rgba("chalk", 245))
        tcol, bx = rgba("night"), tail
        tail_poly = [(tail + 30, h - 26), (0, h), (tail + 44, h - 2)]
        tail_col = rgba("chalk", 245)
    ImageDraw.Draw(canvas).polygon(tail_poly, fill=tail_col)
    canvas.alpha_composite(body, (bx, 0))
    d = ImageDraw.Draw(canvas)
    for i, l in enumerate(lines):
        d.text((bx + 28, 18 + i * lh), l, font=f, fill=tcol)
    return canvas


def fx_chat(fr, t, c, cfg):
    msgs, gap = c["messages"], c.get("gap", 0.6)
    base = c.get("y", 0.25) * H
    out = ease((c["end"] - t) / 0.35)
    shown = []
    for i, m in enumerate(msgs):
        p = (t - c["start"] - i * gap) / 0.32
        if p > 0:
            shown.append((m, clamp(p)))
    y = base
    for m, p in reversed(shown):
        spr = bubble(m["text"], m.get("side", "l"), cfg.get("mood", "hype"))
        right = m.get("side", "l") == "r"
        x = W - 64 if right else 64
        put(fr, spr, x, y, scale=0.25 + 0.75 * back(p), alpha=min(1, p * 2) * out,
            anchor=(1 if right else 0, 1))
        y -= (spr.height + 18) * ease(p)


def fx_takeover(fr, t, c, cfg, src):
    e = envelope(t, c, 0.45, 0.4)
    if e <= 0:
        return
    bg = blurred_bg(src.convert("RGB"), dark=0.4).convert("RGBA")
    fr.paste(Image.blend(fr, bg, e))
    pw = W - 120
    sprs = [bubble(m["text"], m.get("side", "l"), cfg.get("mood", "hype"), size=34, maxw=pw - 160) for m in c["messages"]]
    ph = int(min(H * 0.62, 200 + sum(s.height + 14 for s in sprs)))
    panel = rrect(pw, ph, 44, rgba("night", 238))
    d = ImageDraw.Draw(panel)
    d.ellipse((36, 34, 108, 106), fill=acc(cfg))
    d.text((72, 70), c.get("name", "Changemakers Lab")[:1].upper(), font=font("black", 40), fill=rgba("night"), anchor="mm")
    d.text((128, 46), c.get("name", "Changemakers Lab"), font=font("bold", 40), fill=rgba("chalk"))
    d.text((128, 92), c.get("status", "online"), font=font("regular", 26), fill=rgba("chalk", 150))
    d.line((0, 140, pw, 140), fill=rgba("chalk", 30), width=2)
    gap = c.get("gap", 0.38)
    items, y = [], ph - 30
    for i, m in enumerate(c["messages"]):
        p = (t - c["start"] - 0.35 - i * gap) / 0.25
        if p > 0:
            items.append((m, sprs[i], clamp(p)))
    for m, spr, p in reversed(items):
        right = m.get("side", "l") == "r"
        if y - spr.height < 160:
            break
        put(panel, spr, pw - 30 if right else 30, y + 20 * (1 - p), alpha=p, anchor=(1 if right else 0, 1))
        y -= (spr.height + 14) * ease(p)
    put(fr, shadow(pw, ph, 44), W / 2, H * 0.43)
    put(fr, panel, W / 2, H * 0.43, scale=0.6 + 0.4 * e, alpha=e)


def draw_card_base(w, h, cfg):
    return rrect(w, h, 36, rgba("night", 225))


def fx_checklist(fr, t, c, cfg):
    e = envelope(t, c, 0.4, 0.35)
    if e <= 0:
        return
    S = 2
    items = c["items"]
    w, rowh, top = 800, 86, (96 if c.get("title") else 34)
    h = top + rowh * len(items) + 24
    card = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    card.alpha_composite(draw_card_base(w * S, h * S, cfg))
    d = ImageDraw.Draw(card)
    if c.get("title"):
        d.text((40 * S, 30 * S), c["title"].upper(), font=font("bold", 28 * S), fill=acc(cfg))
    gap = c.get("gap", 0.5)
    tick = acc(cfg, "cool" if cfg.get("mood") == "heart" else "accent")
    for i, item in enumerate(items):
        p = (t - c["start"] - 0.25 - i * gap)
        a = clamp(p / 0.25)
        if a <= 0:
            continue
        cy = (top + rowh * i + rowh / 2) * S
        cx, r = 62 * S, 22 * S
        fill = ease((p - 0.15) / 0.25)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba("chalk", int(110 * a)), width=3 * S)
        if fill > 0:
            rr = r * fill
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=tick)
        ck = ease((p - 0.35) / 0.25)
        if ck > 0:
            pts = [(cx - 10 * S, cy + 1 * S), (cx - 3 * S, cy + 8 * S), (cx + 11 * S, cy - 8 * S)]
            seg1 = min(ck * 2, 1)
            p1 = (pts[0][0] + (pts[1][0] - pts[0][0]) * seg1, pts[0][1] + (pts[1][1] - pts[0][1]) * seg1)
            d.line([pts[0], p1], fill=rgba("night"), width=5 * S)
            if ck > 0.5:
                s2 = (ck - 0.5) * 2
                p2 = (pts[1][0] + (pts[2][0] - pts[1][0]) * s2, pts[1][1] + (pts[2][1] - pts[1][1]) * s2)
                d.line([pts[1], p2], fill=rgba("night"), width=5 * S, joint="curve")
        d.text((110 * S, cy), item, font=font("semi", 36 * S), fill=rgba("chalk", int(255 * a)), anchor="lm")
    card = card.resize((w, h), Image.LANCZOS)
    y = c.get("y", 0.76) * H
    put(fr, shadow(w, h, 36), W / 2, y + 30 * (1 - e), alpha=e)
    put(fr, card, W / 2, y + 30 * (1 - e), scale=0.96 + 0.04 * e, alpha=e)


def fx_growth(fr, t, c, cfg):
    e = envelope(t, c, 0.4, 0.35)
    if e <= 0:
        return
    S, w, h = 2, 800, 380
    card = draw_card_base(w * S, h * S, cfg).copy()
    d = ImageDraw.Draw(card)
    col = acc(cfg, "cool" if cfg.get("mood") == "heart" else "accent")
    d.text((40 * S, 34 * S), c.get("label", "Peserta"), font=font("semi", 28 * S), fill=rgba("chalk", 170))
    p = ease((t - c["start"] - 0.3) / c.get("draw", 1.0))
    m = re.match(r"^([^\d\-]*)(-?[\d.,]+)(.*)$", str(c.get("value", "+100%")))
    pre, num, suf = (m.group(1), float(m.group(2).replace(",", "")), m.group(3)) if m else ("", 0, str(c.get("value")))
    dec = 1 if m and "." in m.group(2) else 0
    d.text((40 * S, 74 * S), f"{pre}{num * p:,.{dec}f}{suf}", font=font("black", 76 * S), fill=col)
    n = 40
    rng = np.random.default_rng(7)
    ys = np.linspace(0.08, 1, n) ** 1.8 + rng.normal(0, 0.03, n) * np.linspace(1, 0.2, n)
    x0, x1, y0, y1 = 44 * S, (w - 50) * S, (h - 34) * S, 190 * S
    pts = [(x0 + (x1 - x0) * i / (n - 1), y0 - (y0 - y1) * clamp(v, 0, 1)) for i, v in enumerate(ys)]
    k = max(2, int(round(p * (n - 1))) + 1)
    seg = pts[:k]
    if len(seg) > 1:
        area = Image.new("RGBA", card.size, (0, 0, 0, 0))
        ImageDraw.Draw(area).polygon(seg + [(seg[-1][0], y0), (seg[0][0], y0)], fill=col[:3] + (55,))
        card.alpha_composite(area)
        d = ImageDraw.Draw(card)
        d.line(seg, fill=col, width=6 * S, joint="curve")
    card = card.resize((w, h), Image.LANCZOS)
    y = c.get("y", 0.76) * H
    put(fr, shadow(w, h, 36), W / 2, y + 30 * (1 - e), alpha=e)
    put(fr, card, W / 2, y + 30 * (1 - e), alpha=e)
    if len(seg) > 1:
        tx = W / 2 - w / 2 + seg[-1][0] / S
        ty = y - h / 2 + seg[-1][1] / S + 30 * (1 - e)
        pulse = 0.85 + 0.15 * math.sin(t * 8)
        put(fr, halo(18, col), tx, ty, scale=pulse, alpha=e)


def fx_name(fr, t, c, cfg):
    """Name tag. style: bar (glass card + accent bar), pill (accent pill + role underneath), minimal (text only)."""
    e = envelope(t, c, 0.45, 0.35)
    if e <= 0:
        return
    style = c.get("style", "bar")
    size = c.get("size", 54)
    while font("black", size).getlength(c["name"]) > W - 220 and size > 30:
        size -= 2
    nf, rf = font("black", size), font("semi", max(26, int(size * 0.58)))
    role = c.get("role", "")
    nw, rw = int(nf.getlength(c["name"])), int(rf.getlength(role))
    if style == "pill":
        pw, ph = nw + 64, size + 34
        name = rrect(pw, ph, ph // 2, None, grad=(acc(cfg), acc(cfg, "accent2")))
        ImageDraw.Draw(name).text((32, ph / 2), c["name"], font=nf, fill=rgba("night"), anchor="lm")
        spr = Image.new("RGBA", (max(pw, rw + 40), ph + (rf.size + 30 if role else 0)), (0, 0, 0, 0))
        spr.alpha_composite(name)
        if role:
            tag = rrect(rw + 36, rf.size + 22, 12, rgba("night", 210))
            ImageDraw.Draw(tag).text((18, (rf.size + 22) / 2), role, font=rf, fill=rgba("chalk"), anchor="lm")
            spr.alpha_composite(tag, (16, ph + 8))
    elif style == "minimal":
        spr = Image.new("RGBA", (max(nw, rw) + 40, size + (rf.size + 26 if role else 0) + 30), (0, 0, 0, 0))
        d = ImageDraw.Draw(spr)
        d.text((10, 6), c["name"], font=nf, fill=rgba("chalk"), stroke_width=4, stroke_fill=rgba("night", 150))
        if role:
            d.line((12, size + 18, 12 + min(rw, 120), size + 18), fill=acc(cfg), width=4)
            d.text((12, size + 28), role, font=rf, fill=rgba("chalk"), stroke_width=3, stroke_fill=rgba("night", 150))
    else:
        w = max(nw, rw) + 90
        h = size + (rf.size + 54 if role else 44)
        spr = rrect(w, h, 26, rgba("night", 220))
        d = ImageDraw.Draw(spr)
        spr.alpha_composite(rrect(12, h - 36, 6, None, grad=(acc(cfg), acc(cfg, "accent2"))), (26, 18))
        d.text((56, 20), c["name"], font=nf, fill=rgba("chalk"))
        if role:
            d.text((58, size + 34), role, font=rf, fill=acc(cfg))
    vis = int(spr.width * ease((t - c["start"]) / 0.5))
    if vis < spr.width:
        spr = spr.crop((0, 0, max(vis, 1), spr.height))
    put(fr, spr, 60 - 40 * (1 - e), c.get("y", 0.80) * H, anchor=(0, 0.5), alpha=e)


def sub_groups(c):
    """Split timed words into display groups (by length, punctuation and pauses)."""
    if "_groups" in c:
        return c["_groups"]
    maxch = c.get("maxch", {"pop": 14, "sentence": 46, "box": 24}.get(c.get("style"), 22))
    groups, cur = [], []
    for w in c["words"]:
        if cur:
            n = sum(len(x["w"]) + 1 for x in cur) + len(w["w"])
            if n > maxch or cur[-1]["w"][-1:] in ".?!," or w["s"] - cur[-1]["e"] > 0.45 or w.get("brk"):
                groups.append(cur)
                cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    merged = []
    for g in groups:  # don't strand a single word: fold it into the group before it
        if merged and len(g) == 1 and not g[0].get("brk") and g[0]["s"] - merged[-1][-1]["e"] < 0.35 \
                and merged[-1][-1]["w"][-1:] not in ".?!" \
                and sum(len(x["w"]) + 1 for x in merged[-1]) + len(g[0]["w"]) <= maxch + 10:
            merged[-1] = merged[-1] + g
        else:
            merged.append(g)
    groups = merged
    for i, g in enumerate(groups):  # sentence case after a cut or a full stop
        if g[0].get("brk") or i == 0 or groups[i - 1][-1]["w"][-1:] in ".?!":
            g[0] = dict(g[0], w=g[0]["w"][:1].upper() + g[0]["w"][1:])
    out = []
    for i, g in enumerate(groups):
        nxt = groups[i + 1][0]["s"] if i + 1 < len(groups) else 1e9
        out.append((g[0]["s"] - 0.05, min(g[-1]["e"] + 0.5, nxt - 0.02), g))
    c["_groups"] = out
    return out


def fx_subs(fr, t, c, cfg):
    """Word-timed subtitles. style: karaoke | pop | sentence | box | reveal."""
    style = c.get("style", "karaoke")
    keys = {k.lower() for k in c.get("keywords", [])}
    g = next(((a, b, ws) for a, b, ws in sub_groups(c) if a <= t <= b), None)
    if not g:
        return
    a, b, ws = g
    fade = clamp((t - a) / 0.12) * clamp((b - t) / 0.12)
    key = lambda w: w["w"].lower().strip(".,!?\"'") in keys
    upper = c.get("upper", style in ("pop", "karaoke"))
    txt = lambda w: w["w"].upper() if upper else w["w"]
    if style == "pop":
        f = font("black", c.get("size", 92))
        shown = [w for w in ws if w["s"] <= t + 0.02]
        if not shown:
            return
        lines, cur = [], []
        for w in shown:
            if cur and f.getlength(" ".join(txt(x) for x in cur + [w])) > W - 140:
                lines.append(cur)
                cur = []
            cur.append(w)
        lines.append(cur)
        lh = int(f.size * 1.12)
        spr = Image.new("RGBA", (W, lh * len(lines) + 40), (0, 0, 0, 0))
        for li, line in enumerate(lines):
            x = (W - f.getlength(" ".join(txt(x) for x in line))) / 2
            for w in line:
                p = back(clamp((t - w["s"]) / 0.16), 2.2)
                ww = f.getlength(txt(w))
                gl = Image.new("RGBA", (int(ww) + 30, lh + 30), (0, 0, 0, 0))
                ImageDraw.Draw(gl).text((15, 12), txt(w), font=f, fill=acc(cfg) if key(w) else rgba("chalk"),
                                        stroke_width=7, stroke_fill=rgba("night", 235))
                put(spr, gl, x + ww / 2, 20 + li * lh + lh / 2, scale=0.55 + 0.45 * p, alpha=clamp(p * 1.5))
                x += ww + f.getlength(" ")
        put(fr, spr, W / 2, c.get("y", 0.64) * H, alpha=fade)
        return
    if style == "sentence":
        f = font("semi", c.get("size", 46))
        text = " ".join(w["w"] for w in ws)
        lines = wrap(text, f, W - 160)
        if len(lines) == 2:  # balance the two lines
            parts = text.split()
            k = min(range(1, len(parts)), key=lambda i: abs(f.getlength(" ".join(parts[:i])) - f.getlength(" ".join(parts[i:]))))
            lines = [" ".join(parts[:k]), " ".join(parts[k:])]
        lh = int(f.size * 1.32)
        bw = int(max(f.getlength(l) for l in lines)) + 56
        spr = rrect(bw, lh * len(lines) + 30, 18, rgba("night", 150))
        d = ImageDraw.Draw(spr)
        for i, l in enumerate(lines):
            d.text((bw / 2, 15 + i * lh + lh / 2), l, font=f, fill=rgba("chalk"), anchor="mm")
        put(fr, spr, W / 2, c.get("y", 0.84) * H, alpha=fade)
        return
    f = font("bold" if style == "box" else "black", c.get("size", 54 if style == "box" else 64))
    words = [w for w in ws if w["s"] <= t + 0.02] if style == "box" else ws
    if not words:
        return
    lines, cur = [], []
    for w in words:
        if cur and f.getlength(" ".join(txt(x) for x in cur + [w])) > W - 160:
            lines.append(cur)
            cur = []
        cur.append(w)
    lines.append(cur)
    lh = int(f.size * 1.3)
    if style == "box":
        bw = int(max(f.getlength(" ".join(txt(x) for x in l)) for l in lines)) + 60
        spr = rrect(bw, lh * len(lines) + 30, 22, rgba("chalk", 245))
        x0 = 30
    else:
        bw = W
        spr = Image.new("RGBA", (W, lh * len(lines) + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(spr)
    for li, line in enumerate(lines):
        lw = f.getlength(" ".join(txt(x) for x in line))
        x = 30 if style == "box" else (W - lw) / 2
        y = 15 + li * lh
        for w in line:
            ww = f.getlength(txt(w))
            nxt = next((x["s"] for x in ws if x["s"] > w["s"]), w["e"] + 0.3)
            on = w["s"] <= t < min(nxt, w["e"] + 0.3)
            said = w["s"] <= t
            if style == "box":
                if key(w):
                    d.rounded_rectangle((x - 8, y - 2, x + ww + 8, y + f.size + 12), 10, fill=acc(cfg))
                d.text((x, y), txt(w), font=f, fill=rgba("night"))
            elif style == "reveal":
                col = (acc(cfg) if key(w) else rgba("chalk")) if said else rgba("chalk", 95)
                d.text((x, y), txt(w), font=f, fill=col, stroke_width=5, stroke_fill=rgba("night", 200 if said else 90))
            else:  # karaoke
                if on:
                    d.rounded_rectangle((x - 10, y - 4, x + ww + 10, y + f.size + 14), 12, fill=acc(cfg))
                col = rgba("night") if on else (acc(cfg, "accent2") if key(w) else rgba("chalk"))
                d.text((x, y), txt(w), font=f, fill=col, stroke_width=0 if on else 5, stroke_fill=rgba("night", 220))
            x += ww + f.getlength(" ")
    pop = 0.94 + 0.06 * back(clamp((t - a) / 0.15))
    put(fr, spr, W / 2, c.get("y", 0.71) * H, scale=pop if style != "box" else 1.0, alpha=fade)


def fx_question(fr, t, c, cfg):
    """Interview question card at the top of the frame."""
    e = envelope(t, c, 0.45, 0.4)
    if e <= 0:
        return
    qf, lf = font("black", c.get("size", 60)), font("bold", 26)
    lines = wrap(c["text"], qf, W - 220)
    lh = int(qf.size * 1.18)
    w = int(max(qf.getlength(l) for l in lines)) + 80
    h = lh * len(lines) + 96
    spr = rrect(w, h, 30, rgba("night", 225))
    d = ImageDraw.Draw(spr)
    lab = c.get("label", "SOALAN")
    pill = rrect(int(lf.getlength(lab)) + 36, 40, 20, None, grad=(acc(cfg), acc(cfg, "accent2")))
    ImageDraw.Draw(pill).text((18, 20), lab, font=lf, fill=rgba("night"), anchor="lm")
    spr.alpha_composite(pill, (40, 26))
    for i, l in enumerate(lines):
        d.text((40, 80 + i * lh), l, font=qf, fill=rgba("chalk"))
    put(fr, shadow(w, h, 30), W / 2, c.get("y", 0.17) * H - 30 * (1 - e), alpha=e)
    put(fr, spr, W / 2, c.get("y", 0.17) * H - 30 * (1 - e), alpha=e, scale=0.96 + 0.04 * e)


def fx_caption(fr, t, c, cfg):
    e = envelope(t, c, 0.2, 0.2)
    if e <= 0:
        return
    f = font("black", c.get("size", 64))
    hl = {w.lower().strip(".,!?") for w in c.get("highlight", [])}
    lines = wrap(c["text"], f, W - 160)
    lh = int(f.size * 1.25)
    spr = Image.new("RGBA", (W, lh * len(lines) + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(spr)
    for li, line in enumerate(lines):
        x = (W - f.getlength(line)) / 2
        y = 10 + li * lh
        for word in line.split():
            ww = f.getlength(word)
            on = word.lower().strip(".,!?") in hl
            if on:
                d.rounded_rectangle((x - 12, y - 4, x + ww + 12, y + f.size + 10), 14, fill=acc(cfg))
            d.text((x, y), word, font=f, fill=rgba("night") if on else rgba("chalk"),
                   stroke_width=0 if on else 5, stroke_fill=rgba("night", 220))
            x += ww + f.getlength(" ")
    put(fr, spr, W / 2, c.get("y", 0.66) * H, scale=0.9 + 0.1 * back(clamp((t - c["start"]) / 0.25)), alpha=e)


class Clip:
    """Sequential frame reader for a B-roll file, scaled to the card."""

    def __init__(self, path, w, h):
        self.path, self.w, self.h, self.proc, self.idx, self.last = path, w, h, None, -1, None

    def at(self, i, seek=False):
        if seek or self.proc is None or i < self.idx:
            if self.proc:
                self.proc.kill()
            self.proc = subprocess.Popen(
                ["ffmpeg", "-v", "error", "-ss", f"{i / FPS:.3f}", "-i", self.path, "-vf",
                 f"scale={self.w}:{self.h}:force_original_aspect_ratio=increase,crop={self.w}:{self.h},fps={FPS}",
                 "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            self.idx = i - 1
        while self.idx < i:
            buf = self.proc.stdout.read(self.w * self.h * 3)
            if len(buf) < self.w * self.h * 3:
                break  # B-roll shorter than cue: hold last frame
            self.last = Image.frombytes("RGB", (self.w, self.h), buf)
            self.idx += 1
        return self.last


def fx_broll(fr, t, c, cfg, ctx):
    e = envelope(t, c, 0.45, 0.4)
    if e <= 0:
        return
    w = c.get("width", 760)
    h = int(w * (16 / 9 if c.get("vertical") else 9 / 16))
    key = id(c)
    if key not in ctx["clips"]:
        ctx["clips"][key] = Clip(c["file"], w, h)
    img = ctx["clips"][key].at(int((t - c["start"]) * FPS), seek=ctx.get("preview", False))
    if img is None:
        return
    spr = img.convert("RGBA")
    spr.putalpha(rmask(w, h, 32))
    lab = c.get("label", "B-ROLL")
    lf = font("bold", 24)
    pill = rrect(int(lf.getlength(lab)) + 44, 44, 22, rgba("night", 210))
    ImageDraw.Draw(pill).ellipse((14, 16, 26, 28), fill=acc(cfg, "accent2"))
    ImageDraw.Draw(pill).text((34, 22), lab, font=lf, fill=rgba("chalk"), anchor="lm")
    spr.alpha_composite(pill, (18, 18))
    y = c.get("y", 0.76) * H
    x = W / 2 + 260 * (1 - e) * (1 if c.get("from", "right") == "right" else -1)
    put(fr, shadow(w, h, 32), x, y, alpha=e)
    put(fr, spr, x, y, rot=-7 * (1 - e), alpha=e)


def fx_glitch(img, t, c):
    if not (c["start"] <= t <= c["end"]):
        return img
    a = np.asarray(img).copy()
    k = 1 - (t - c["start"]) / max(c["end"] - c["start"], 0.01)
    rng = np.random.default_rng(int(t * FPS))
    dx = int(28 * k) + 2
    a[..., 0] = np.roll(a[..., 0], dx, 1)
    a[..., 2] = np.roll(a[..., 2], -dx, 1)
    for _ in range(int(6 * k) + 1):
        y0 = rng.integers(0, H - 80)
        hh = rng.integers(10, 80)
        a[y0:y0 + hh] = np.roll(a[y0:y0 + hh], rng.integers(-60, 60), 1)
    return Image.fromarray(a)


def fx_spotlight(fr, t, c, cfg):
    e = envelope(t, c, 0.5, 0.5)
    if e <= 0:
        return
    key = ("spot", cfg.get("mood"), tuple(cfg.get("face", [0.5, 0.36])))
    if key not in SPOT:
        yy, xx = np.mgrid[0:H // 4, 0:W // 4]
        fx_, fy_ = cfg.get("face", [0.5, 0.36])
        dist = np.sqrt(((xx - fx_ * W / 4) / (W / 4)) ** 2 + ((yy - (fy_ + 0.12) * H / 4) / (H / 4)) ** 2 * 1.6)
        dark = (np.clip((dist - 0.28) / 0.45, 0, 1) * 200).astype(np.uint8)
        layer = np.zeros((H // 4, W // 4, 4), np.uint8)
        layer[..., 3] = dark
        ring = np.exp(-((dist - 0.42) / 0.09) ** 2)
        col = np.array(acc(cfg, "cool")[:3])
        rim = np.zeros_like(layer)
        rim[..., :3] = col
        rim[..., 3] = (ring * 85).astype(np.uint8)
        SPOT[key] = (Image.fromarray(layer).resize((W, H), Image.BICUBIC),
                     Image.fromarray(rim).resize((W, H), Image.BICUBIC))
    dark, rim = SPOT[key]
    put(fr, dark, 0, 0, anchor=(0, 0), alpha=e)
    put(fr, rim, 0, 0, anchor=(0, 0), alpha=e * (0.55 + 0.45 * math.sin(t * 3.2) ** 2))


SPOT = {}


def fx_endcard(fr, t, c, cfg):
    e = ease((t - c["start"]) / 0.5)
    if e <= 0:
        return
    key = ("end", cfg.get("mood"))
    if key not in SPOT:
        yy, xx = np.mgrid[0:H // 8, 0:W // 8].astype(float)
        a = np.zeros((H // 8, W // 8, 3))
        a[:] = np.array(rgba("night")[:3])
        for cx, cy, col, r in ((0.15, 0.2, "cyan", 0.55), (0.9, 0.35, "magenta", 0.6), (0.5, 0.95, "ignite", 0.5)):
            g = np.exp(-(((xx / (W / 8)) - cx) ** 2 + ((yy / (H / 8)) - cy) ** 2 * 0.5) / (r * r * 0.25))[..., None]
            a = a * (1 - 0.55 * g) + np.array(rgba(col)[:3]) * 0.55 * g
        SPOT[key] = Image.fromarray(a.astype(np.uint8)).resize((W, H), Image.BICUBIC).convert("RGBA")
    put(fr, SPOT[key], 0, 0, anchor=(0, 0), alpha=e)
    p = back(clamp((t - c["start"] - 0.3) / 0.6))
    lg = logo(c.get("logo", "changemakers-lab.webp"), 900, 640 if not c.get("logo_card") else 520)
    if c.get("logo_card"):  # logos with dark type need a light card behind them on the night gradient
        card = rrect(lg.width + 120, lg.height + 100, 48, rgba("chalk", 250))
        card.alpha_composite(lg, (60, 50))
        lg = card
    put(fr, lg, W / 2, H * 0.33, scale=0.7 + 0.3 * p, alpha=clamp(p))
    q = ease((t - c["start"] - 0.8) / 0.5)
    hf = font("black", 70)
    for i, line in enumerate(wrap(c.get("text", "TERIMA KASIH, CHANGEMAKERS!").upper(), hf, W - 140)):
        tl = Image.new("RGBA", (W, 96), (0, 0, 0, 0))
        ImageDraw.Draw(tl).text((W / 2, 48), line, font=hf, fill=rgba("chalk"), anchor="mm")
        put(fr, tl, W / 2, H * 0.58 + i * 90 + 30 * (1 - q), alpha=q)
    if c.get("sub"):
        sf = font("semi", 40)
        tl = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
        ImageDraw.Draw(tl).text((W / 2, 30), c["sub"], font=sf, fill=rgba("gold"), anchor="mm")
        put(fr, tl, W / 2, H * 0.71, alpha=ease((t - c["start"] - 1.1) / 0.5))
    r = ease((t - c["start"] - 1.4) / 0.5)
    if c.get("partners", True) and r > 0:
        gv, hs = logo("gengvolunteers.png", 330, 150), logo("heartspace.png", 380, 110)
        pw = gv.width + hs.width + 140
        pill = rrect(pw, 190, 40, rgba("chalk", 250))
        pill.alpha_composite(gv, (50, (190 - gv.height) // 2))
        pill.alpha_composite(hs, (90 + gv.width, (190 - hs.height) // 2))
        put(fr, pill, W / 2, H * 0.84 + 30 * (1 - r), alpha=r)


# ---------------------------------------------------------------- frame pipeline

OVERLAY_ORDER = ["spotlight", "takeover", "title", "chat", "checklist", "growth", "broll", "question", "name", "caption", "subs"]


def compose(img, t, cfg, ctx):
    src = img
    img = camera(img, t, cfg)
    for c in cfg["cues"]:
        if c["fx"] == "glitch":
            img = fx_glitch(img, t, c)
    fr = img.convert("RGBA")
    active = [c for c in cfg["cues"] if c["start"] <= t <= c["end"]]
    active.sort(key=lambda c: OVERLAY_ORDER.index(c["fx"]) if c["fx"] in OVERLAY_ORDER else 99)
    for c in active:
        f = c["fx"]
        if f == "title":
            fx_title(fr, t, c, cfg)
        elif f == "chat":
            fx_chat(fr, t, c, cfg)
        elif f == "takeover":
            fx_takeover(fr, t, c, cfg, src)
        elif f == "checklist":
            fx_checklist(fr, t, c, cfg)
        elif f == "growth":
            fx_growth(fr, t, c, cfg)
        elif f == "name":
            fx_name(fr, t, c, cfg)
        elif f == "caption":
            fx_caption(fr, t, c, cfg)
        elif f == "subs":
            fx_subs(fr, t, c, cfg)
        elif f == "question":
            fx_question(fr, t, c, cfg)
        elif f == "broll":
            fx_broll(fr, t, c, cfg, ctx)
        elif f == "spotlight":
            fx_spotlight(fr, t, c, cfg)
    fx_brand(fr, t, cfg, ctx)
    for c in cfg["cues"]:
        if c["fx"] == "endcard" and t >= c["start"]:
            fx_endcard(fr, t, c, cfg)
    return fr.convert("RGB")


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    return float(j["format"]["duration"]), any(s["codec_type"] == "audio" for s in j["streams"])


def vf(cfg, grade=None):
    g = grade or cfg.get("grade", "natural")
    chain = []
    if cfg.get("frame"):  # static reframe: {"zoom": 1.5, "center": [x, y]} as fractions of the source
        z, (cx, cy) = cfg["frame"].get("zoom", 1.0), cfg["frame"].get("center", [0.5, 0.5])
        chain.append(f"crop=iw/{z}:ih/{z}:min(max(iw*{cx}-iw/{z}/2\\,0)\\,iw-iw/{z}):"
                     f"min(max(ih*{cy}-ih/{z}/2\\,0)\\,ih-ih/{z})")
    chain += [f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos", f"crop={W}:{H}", f"fps={FPS}"]
    if g and g != "none":
        chain.append(PAL["grades"].get(g, g))
    return ",".join(chain + ["format=rgb24"])


def load_cfg(path):
    cfg = json.load(open(path))
    base = os.path.dirname(os.path.abspath(path))
    for c in cfg["cues"]:
        if c.get("file") and not os.path.isabs(c["file"]):
            c["file"] = os.path.join(base, c["file"])
        c.setdefault("end", c["start"] + c.get("dur", 2.0))
    return cfg


def make_ctx(cfg, duration, preview=False):
    ec = [c for c in cfg["cues"] if c["fx"] == "endcard"]
    return {"duration": duration, "clips": {}, "preview": preview,
            "endcard_len": (duration - ec[0]["start"]) if ec else 0}


def sfx_track(cfg, duration, path):
    """Soft UI pops on chat bubbles / checklist ticks, a low thump on snap zooms."""
    n = int(duration * SR) + SR
    buf = np.zeros(n)

    def pop(t0, f0=1250, f1=700, dur=0.09, amp=0.22):
        k = np.arange(int(dur * SR)) / SR
        freq = np.linspace(f0, f1, k.size)
        s = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-k * 38) * amp
        i = int(t0 * SR)
        buf[i:i + s.size] += s[: max(0, n - i)]

    for c in cfg["cues"]:
        if c.get("sfx") is False:
            continue
        if c["fx"] == "chat":
            for i in range(len(c["messages"])):
                pop(c["start"] + i * c.get("gap", 0.6))
        elif c["fx"] == "checklist":
            for i in range(len(c["items"])):
                pop(c["start"] + 0.6 + i * c.get("gap", 0.5), 1600, 1100, 0.07, 0.16)
        elif c["fx"] == "snap":
            pop(c["start"], 160, 60, 0.22, 0.45)
        elif c["fx"] == "glitch":
            pop(c["start"], 2400, 300, 0.15, 0.12)
    pcm = (np.clip(buf, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def render(inp, cue_path, out):
    cfg = load_cfg(cue_path)
    duration, has_audio = probe(inp)
    ctx = make_ctx(cfg, duration)
    sfx = out + ".sfx.wav"
    sfx_track(cfg, duration, sfx)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", inp, "-vf", vf(cfg), "-f", "rawvideo", "-"],
                           stdout=subprocess.PIPE)
    if has_audio:
        amix = "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[2:a]aformat=channel_layouts=stereo[a1];" \
               "[a0][a1]amix=inputs=2:duration=first:normalize=0[a]"
    else:
        amix = "[2:a]aformat=channel_layouts=stereo[a]"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-i", inp, "-i", sfx, "-filter_complex", amix, "-map", "0:v", "-map", "[a]",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
         "-shortest", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    i, size = 0, W * H * 3
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        t = i / FPS
        enc.stdin.write(compose(Image.frombytes("RGB", (W, H), buf), t, cfg, ctx).tobytes())
        i += 1
        if i % (FPS * 2) == 0:
            print(f"  {t:5.1f}s / {duration:.1f}s", file=sys.stderr, flush=True)
    enc.stdin.close()
    enc.wait()
    dec.wait()
    os.remove(sfx)
    print(f"rendered {i} frames -> {out}")


def grab(inp, t, cfg, grade=None):
    buf = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", inp, "-frames:v", "1", "-vf",
                          vf(cfg, grade), "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return Image.frombytes("RGB", (W, H), buf[: W * H * 3])


def preview(inp, cue_path, outdir):
    cfg = load_cfg(cue_path)
    duration, _ = probe(inp)
    ctx = make_ctx(cfg, duration, preview=True)
    os.makedirs(outdir, exist_ok=True)
    paths = []
    for n, c in enumerate(cfg["cues"], 1):
        if c["fx"] == "endcard":
            t = min(c["start"] + 2.2, duration - 0.05)
        elif c["fx"] in ("snap", "glitch"):
            t = c["start"] + (0.06 if c["fx"] == "glitch" else (c["end"] - c["start"]) / 2)
        else:
            t = c["start"] + (c["end"] - c["start"]) * c.get("preview_at", 0.65)
        p = os.path.join(outdir, f"{n:02d}-{c['fx']}.jpg")
        compose(grab(inp, t, cfg), t, cfg, ctx).save(p, quality=88)
        paths.append(p)
        print(p)
    return paths


def label_for(path):
    b = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"^\d+-", "", b).replace("_", " ").upper()


def sheet(out, paths, labels=None, cols=None, tw=300):
    cols = cols or min(len(paths), 5)
    th = int(tw * 16 / 9)
    rows = math.ceil(len(paths) / cols)
    pad, lab = 24, 54
    im = Image.new("RGB", (pad + cols * (tw + pad), pad + rows * (th + lab + pad)), rgba("night")[:3])
    d = ImageDraw.Draw(im)
    for i, p in enumerate(paths):
        x, y = pad + (i % cols) * (tw + pad), pad + (i // cols) * (th + lab + pad)
        th_im = Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS)
        m = rmask(tw, th, 18)
        im.paste(th_im, (x, y), m)
        d.text((x + tw / 2, y + th + 28), (labels or [label_for(q) for q in paths])[i], font=font("bold", 24),
               fill=rgba("chalk"), anchor="mm")
    im.save(out, quality=90)
    print(out)


def compare(inp, t, out):
    cfg = {"cues": []}
    tmp = []
    for g in ("natural", "hype", "heart"):
        p = f"{out}.{g}.jpg"
        grab(inp, float(t), cfg, g).save(p, quality=92)
        tmp.append(p)
    sheet(out, tmp, ["NATURAL", "HYPE (moments)", "HEART (feedback)"], cols=3, tw=340)
    for p in tmp:
        os.remove(p)


def standin(out, seconds=14.0):
    """Synthetic 9:16 talking-head stand-in: warm room bokeh + skin-tone silhouette that sways."""
    seconds = float(seconds)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    bg = np.zeros((H, W, 3), np.float32)
    bg[:] = np.array([38, 30, 34])
    bg += (1 - yy[..., None] / H) * np.array([30, 24, 18])
    rng = np.random.default_rng(3)
    for _ in range(22):
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H * 0.6), rng.uniform(30, 110)
        col = rng.choice([[255, 190, 110], [120, 200, 255], [255, 140, 90], [90, 220, 160]])
        g = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r))[..., None]
        bg += g * np.array(col) * 0.22
    bg = np.clip(bg, 0, 255).astype(np.uint8)
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-f", "lavfi", "-i", f"anoisesrc=color=brown:amplitude=0.015:d={seconds}", "-shortest",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", out],
        stdin=subprocess.PIPE)
    base = Image.fromarray(bg)
    for i in range(int(seconds * FPS)):
        t = i / FPS
        fr = base.copy()
        d = ImageDraw.Draw(fr)
        sx = 18 * math.sin(t * 1.3)
        sy = 6 * math.sin(t * 2.1)
        d.rounded_rectangle((W * 0.12 + sx, H * 0.50 + sy, W * 0.88 + sx, H * 1.1), 260, fill=(22, 34, 66))
        d.rectangle((W * 0.43 + sx, H * 0.43 + sy, W * 0.57 + sx, H * 0.52 + sy), fill=(176, 120, 88))
        d.ellipse((W * 0.33 + sx, H * 0.22 + sy, W * 0.67 + sx, H * 0.47 + sy), fill=(198, 142, 106))
        d.chord((W * 0.31 + sx, H * 0.19 + sy, W * 0.69 + sx, H * 0.40 + sy), 180, 360, fill=(30, 24, 22))
        mouth = 6 + 14 * abs(math.sin(t * 9)) * (0.5 + 0.5 * math.sin(t * 1.7))
        d.ellipse((W * 0.46 + sx, H * 0.405 + sy, W * 0.54 + sx, H * 0.405 + sy + mouth), fill=(110, 50, 50))
        for ex in (0.42, 0.58):
            d.ellipse((W * ex - 14 + sx, H * 0.335 + sy, W * ex + 14 + sx, H * 0.335 + sy + 20), fill=(30, 22, 20))
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    enc.wait()
    print(out)


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, args = a[0], a[1:]
    {"render": lambda: render(*args[:3]),
     "preview": lambda: preview(*args[:3]),
     "compare": lambda: compare(*args[:3]),
     "sheet": lambda: sheet(args[0], args[1:]),
     "standin": lambda: standin(*args[:2])}[cmd]()


if __name__ == "__main__":
    main()

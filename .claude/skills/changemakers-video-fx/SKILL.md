---
name: changemakers-video-fx
description: Edit Changemakers Lab / GengVolunteers vertical videos (feedback/testimony videos and event-moment highlight videos) with branded motion effects in the Changemakers Lab 1.0/2026 JOMKORA palette — title pop, zoom, snap zoom, pop-up chat, chat takeover, checklist, growth curve, B-roll card, name tag, captions, glitch, spotlight, end card — and A/B test the styles. Use when the user asks to edit, add effects to, colour-grade, or compare edits of a Changemakers Lab, JOMKORA, GengVolunteers or HeartSpace video, or says "edit video feedback/momen".
---

# Changemakers Lab video FX

Renders branded effects onto a 9:16 clip with `scripts/fx.py` (ffmpeg + Pillow + numpy, no
templates, no paid tools). Effects are driven by a **cue sheet** (JSON) whose times are seconds on the
already-cut clip. Based on the "10 Effect Video yang Bisa Dibikin Claude" prompt pack (@abits.me),
re-styled for Changemakers Lab.

## Palette (`palette.json`)

| Token | Hex | Role |
|---|---|---|
| night | `#0B1026` | backgrounds, card glass |
| navy | `#16204A` | card fill, brand pill |
| gold | `#FFC83D` | hero accent, highlights, progress bar |
| ignite | `#FF7A1A` | energy, right chat bubble |
| magenta | `#C531D9` | gradient partner of ignite |
| cyan | `#2EC4F1` | cool accent, glitch, spotlight rim |
| chalk | `#F5F7FF` | text on dark |
| gvblue / gvorange | `#034B90` / `#E86F3B` | GengVolunteers partner |
| teal / blush | `#1DC4D7` / `#FFA8A9` | HeartSpace, feedback mood |

Two **moods** switch every accent at once: `"mood": "hype"` (gold/ignite/magenta, for moment videos)
and `"mood": "heart"` (teal/blush/gold, for feedback videos). Three **grades**: `natural`, `hype`
(teal shadows, warm highlights, +contrast), `heart` (soft, lifted, warm-pink). Grades are deliberately
mild — never push skin tones.

## Workflow (always in this order)

1. **Inspect** the raw clip: `ffprobe`, and grab 2–3 frames to find where the face is
   (set `"face": [x, y]` as fractions; default `[0.5, 0.36]`).
2. **Clean cut first** (prompt-pack Step 1): transcribe, drop silences / "eee" / repeated or wrong
   takes (keep the last good take), never cut mid-word. Send the user the list of cuts and wait for OK.
   Word timestamps: ask before installing `faster-whisper`; otherwise ask the user for rough times.
3. **Write the cue sheet** — anchor each effect to a spoken sentence (keep it in `"say"` so it can be
   re-timed after re-cuts). Start from `examples/moments.json` or `examples/feedback.json`.
4. **Preview stills, then wait for OK**:
   `python3 scripts/fx.py preview cut.mp4 cues.json previews/` and
   `python3 scripts/fx.py sheet previews.jpg previews/*.jpg` — show the sheet.
5. **Render**: `python3 scripts/fx.py render cut.mp4 cues.json out.mp4` (1080×1920, 30 fps, H.264,
   original audio + soft UI pops; ~0.12 s per frame, so 1 min ≈ 4 min).
6. **Revise** with the revision prompt (below), re-preview only the changed cue.

## Cue reference

Every cue has `fx`, `start`, `end` (or `dur`). Optional `y` = vertical centre as a fraction of height.

| fx | Prompt-pack effect | Fields |
|---|---|---|
| `title` | 01 Teks besar (above head) | `text`, `sub`, `size` |
| `zoom` | 02 Zoom in | `scale` (≤1.25) |
| `card` | 02 Zoom out → rounded card over blurred self | `scale` (~0.8) |
| `snap` | 03 Snap zoom (3–4 frames, blur, snap back) | `scale` (~1.45), `frames` |
| `chat` | 04 Pop-up chat (bounce, stack, pop sound) | `messages:[{side:"l"/"r", text}]`, `gap` |
| `takeover` | 05 Chat takeover panel | `name`, `status`, `messages`, `gap` |
| `checklist` | 06 Checklist pop (auto-lifts video) | `title`, `items` (3–4), `gap`, `lift` |
| `broll` | 07 B-roll card (swing-in, label) | `file`, `label`, `from`, `vertical`, `lift` |
| `growth` | 08 Growth curve + counter + glowing tip | `label`, `value` (e.g. `"+312%"`) |
| `glitch` | 10 entry glitch (RGB split, ~0.3 s) | — |
| `spotlight` | 10 Glow (approximation: vignette + breathing rim) | — |
| `name` | extra: testimony name tag (wipe in) | `name`, `role` |
| `caption` | extra: big caption with highlighted words | `text`, `highlight:[...]`, `size` |
| `endcard` | extra: Lab logo, thank-you, partner logos | `text`, `sub`, `partners` |

Top-level: `mood`, `grade`, `face`, `brand: {text, sub}` (persistent pill + progress bar),
`frame: {zoom, center:[x, y]}` (static reframe of the source, e.g. `1.5` for speakers filmed full-body).

Phone footage is often HDR (HLG / Dolby Vision, `color_transfer=arib-std-b67`). Tone-map it to SDR when
making working copies, or it looks washed out:
`zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`.
`"sfx": false` on a cue mutes its pop.

Not built yet (need a person cut-out / matte): true **text behind head** (01), **orbit icons** (09),
**body glow outline** (10). To add them, ask the user before installing `rembg` (downloads a ~170 MB
model), generate a per-frame alpha matte, and composite: video → behind-layer → person → front-layer.

## Which effect for which video

**Feedback / testimony (mood `heart`)** — trust first, effects second. `name` in the first 3 s,
`caption` + gentle `zoom` on the best line, `checklist` for "apa saya dapat", `takeover` to stack
several short quotes, `card` zoom-out as the closing reveal, `endcard`. Max ~1 effect per 4 s.

**Moments / highlights (mood `hype`)** — energy. `spotlight`+`title`+`glitch` hook in the first
1.5 s, `snap` on the loudest word (1–2 per video), `chat` for crowd reactions, `broll` for activity
shots, `growth` only with real numbers, `endcard` with partners.

## A/B testing the styles

Render two versions that differ in ONE thing, publish both (e.g. Instagram trial reels / two TikTok
posts 48 h apart, same time of day), then compare 3-second hold, average watch %, shares + saves.

| Test | A | B |
|---|---|---|
| Grade | `hype` | `heart` (same cues) |
| Punchline | `snap` | `zoom` |
| Quotes | `chat` | `takeover` |
| Takeaways | `checklist` | `caption` |
| Hook | `title` + `glitch` | `name` + `caption` |

`python3 scripts/fx.py compare clip.mp4 SECONDS grades.jpg` shows natural / hype / heart side by side.

## Prompts the user can send (Bahasa Melayu)

- **Mula:** "Ini video raw aku: [fail.mp4], video [feedback/momen] Changemakers Lab. Rapikan dulu
  (potong jeda, 'eee', take salah), hantar senarai potongan. Lepas tu guna skill changemakers-video-fx
  mood [hype/heart]."
- **Efek:** "Masa aku cakap "[ayat]", buat [snap zoom / pop-up chat: ... / checklist: ... / tajuk
  besar "[TEKS]"]."
- **A/B:** "Render 2 versi: A [hype + snap], B [heart + zoom]. Sama potongan."
- **Revisi:** "Revisi masa aku cakap "[ayat]" (sekitar [00:12]): [apa tak kena]. Aku nak [hasil].
  Hantar preview dulu sebelum render semula."

## Rules

- Never cover the face; keep cards under the chin (`lift` raises the video while they show).
- Use real numbers in `growth`; label examples as examples.
- Only use the participant's name/face with their consent; ask before publishing anything.
- Keep text short: titles 1–2 words, chat ≤ 5–7 words per bubble, checklist 3–4 one-line items.

# Glyph System Studio — launch film

**Format:** 16:9, 1920 × 1080, 30 fps · **Runtime:** ~70 s · **Sound:** music + UI foley, no voiceover (on-screen type carries the story)

**Logline:** Three shapes and five relations are enough to write an idea. We watch the grammar assemble itself, then step back to reveal the studio where you write with it.

**Arc:** *Alphabet → Grammar → Tool → Language.* The first half is pure glyph motion on a flat ground (the grammar on its own). At the midpoint the camera pulls back and the canvas turns out to be the studio canvas. The second half is the UI being used, ending in a fast montage where the glyphs read like words.

**Visual rules**
- Glyph motion uses the studio's own canvas spring (`stiffness 420, damping 32, mass 0.8`), so the film moves the way the app does.
- Act 1–2 use the **Reference** palette (ground `#F2E9E9`, fill `#EB5D36`, ink `#341424`). Palettes only change in Act 5.
- Type: the studio's UI font, lowercase-friendly, set small and calm. One line on screen at a time.
- A cut is always a morph: shapes never vanish, they move into the next glyph.

---

## Act 1 — Alphabet (0:00–0:12)

| Time | Picture | On-screen text | Sound |
|---|---|---|---|
| 0:00 | Empty ground. A dot springs open into a **circle ●**, centred. Holds, breathes a little (scale 1 → 1.03). | *A signal.* | Low pad starts. Soft "pop" on entry. |
| 0:04 | The circle's outline pulls up into a **triangle ▲** (path morph, fill stays). | *A change.* | Rising tick. |
| 0:07 | The triangle settles flat into a **square ■**. | *A structure.* | Lower, wooden tick. |
| 0:10 | The square splits into all three, side by side: ● ▲ ■. | *Three shapes.* | Three ticks, one per shape. |

## Act 2 — Grammar (0:12–0:28)

Two shapes, ● and ■, perform each relation. The notation types itself under the glyph, the way the studio's live formula does.

| Time | Picture | Formula line | On-screen text |
|---|---|---|---|
| 0:12 | ● and ■ slide apart; an ink line **draws** between them with nodes at both ends. | `● — ■` | *leads to* |
| 0:15 | The line retracts; ● rises and lands **on top of** ■. | `● / ■` | *built on* |
| 0:18 | ● shrinks, turns ink, drops **inside** ■. | `● ⊂ ■` | *part of* |
| 0:21 | ● grows back as an **outline across** ■. | `● × ■` | *shares ground* |
| 0:24 | ● shrinks to a flag **tethered above** ■. | `● \| ■` | *derives from* |
| 0:26 | All five relations flash past as a strip, then collapse back to one glyph. | | *Five relations.* |

Sound: each relation has its own short UI foley (line draw = pencil swish, stack = soft thud, nest = click, overlap = glassy chime, anchor = string pluck). Music adds a beat at 0:12.

## Act 3 — The reveal (0:28–0:40)

| Time | Picture | On-screen text |
|---|---|---|
| 0:28 | The glyph builds into **Eclipse** `▲ \| (● × ■)` — "a flag raised over shared ground". | *Enough to write an idea.* |
| 0:32 | **Camera pulls back.** The flat ground shrinks into the studio's grey workspace; around it the UI slides in: left panel (Layers), formula on top, floating toolbar, right panel (Design / Relate). Name tag "Eclipse" pops in at the top-left of the glyph. | — |
| 0:36 | Hold on the full studio, one beat. The formula field reads `▲ \| (● × ■)` with its rule checks green. | **Glyph System Studio** |

Music: drop to a cleaner, rhythmic bed at 0:32.

## Act 4 — Using it (0:40–0:56)

Screen-recorded UI, cut tight, with slow push-ins on the part being used. Cursor is large and smooth.

| Time | Action in the studio | Push-in on | Caption |
|---|---|---|---|
| 0:40 | Click **Clear**, then press `C`, `T`, `S` on the toolbar — three shapes spring onto the canvas. Layers list fills. | Toolbar + canvas | *Add a shape.* |
| 0:44 | Drag the triangle across the canvas; scrub **W** in the Design panel and it grows. | Canvas, then Design panel | *Move it.* |
| 0:47 | In **Relate**: A = ●, relation = **Nest**, B = ■. ● springs inside the square. Formula updates to `(● ⊂ ■) …`. | Relate panel → canvas | *Relate it.* |
| 0:50 | Click the formula, **type** `(▲ ⊂ ●) / ■`. The canvas rebuilds letter by letter as you type → the **Agent** glyph. Press Enter. | Formula field | *Or just write it.* |
| 0:54 | Assets tab: shelf filter clicks through **Design · Code · Systems · Agents & LLMs**. | Left panel | *A whole vocabulary.* |

## Act 5 — Language (0:56–1:06)

Back to full-frame glyphs, no UI. A fast morph montage, one glyph per beat (~0.7 s each), each with its name and formula small at the bottom. Palette rotates every few beats: Reference → Yellow → Blue → Paper → Night.

1. **Chain** `▲ — ● — ■`
2. **Pillar** `(▲ / ■) — ●`
3. **Hub** `■ — {●, ●, ▲}`
4. **Token tiers** `● — ■ — ■`
5. **Function** `● — (▲ ⊂ ■) — ●`
6. **Feedback** `▲ — ● — ■ — ▲`
7. **Context window** `{●, ●, ▲} ⊂ ■`
8. **Tool call** `(▲ ⊂ ●) — ■ — ●`
9. **Fan-out** `(▲ ⊂ ●) — {▲, ▲, ▲}`
10. **Thesis** `● | (■ / ■)`
11. **Iteration** `▲ — ▲ — ▲` (lands on **Night**, the triangles climb and hold)

Caption over the last beat: *Every idea, three shapes.*

## Act 6 — End card (1:06–1:12)

| Time | Picture | Text |
|---|---|---|
| 1:06 | Iteration collapses back to a single **●** (the film's first frame, on Night). Toast slides in bottom-right like the app's: "Link copied". | — |
| 1:08 | ● sits beside the wordmark. | **Glyph System Studio** · *Three shapes. Five relations.* · glyph-system-studio.netlify.app |
| 1:12 | Music resolves. Cut to black. | — |

---

## How we'd build it

- **Glyph motion (Acts 1, 2, 5):** a standalone animation page in this repo that reuses `lib/grammar.ts`, `lib/presets.ts` and `lib/formula.ts`, drives the glyph specs on a timeline with the canvas spring, and renders frame-by-frame (deterministic time) with the pre-installed headless Chromium → PNG frames → `ffmpeg` to MP4 (H.264, 1080p30).
- **UI parts (Acts 3–4):** the real app, driven by a Playwright script (clicks, typing, drags at human pace) and captured the same frame-stepped way, so UI and glyph shots match exactly. The camera pull-back in Act 3 is a CSS transform on the app frame.
- **Sound:** I can't compose music; the render will ship silent (or with a placeholder) and leave timed markers so a track and foley can be laid in.

## Open questions

1. Length: ~70 s as written, or a 30 s cut for social?
2. Captions only, or do you want a voiceover script too?
3. Keep the Agents & LLMs glyphs prominent, or lean more general (Design/Systems)?
4. Any palette or font you want the film to stay in throughout?

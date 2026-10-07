# Glyph System Studio — launch film

**Format:** 16:9, 1920 × 1080, 30 fps · **Runtime:** ~74 s · **Sound:** music + UI foley, no voiceover (on-screen type carries the story)

**Logline:** Three shapes and five relations are enough to write an idea. We watch the grammar assemble itself, then step back to reveal the studio where you write with it.

**Arc:** *Alphabet → Grammar → Tool → Language.* The first half is pure glyph motion on a flat ground (the grammar on its own). At the midpoint the camera pulls back and the canvas turns out to be the studio canvas. The second half breaks the UI into abstract pieces that shape the glyph, then builds compounds faster and faster until they fill a wall.

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

## Act 4 — The pieces (0:40–0:56)

No screen recording. The studio from Act 3 **comes apart**: its panels lift off the workspace, lose their chrome and float as flat, simplified cards around the glyph on the Reference ground. Each card is a redrawn fragment of the real UI (same radii, type and spacing, no dense detail), and each one acts on the glyph in the centre. No cursor; the controls move by themselves.

| Time | Piece (abstracted) | What it does to the glyph | Caption |
|---|---|---|---|
| 0:40 | **Toolbar pill**: just the three shape buttons ● ▲ ■ in a row. | Each button presses in turn and a shape springs out of it onto the ground. | *Add a shape.* |
| 0:44 | **Design card**: only the X / Y / W / H fields. The **W** value counts up. | The triangle grows and slides into place in time with the numbers. | *Shape it.* |
| 0:47 | **Relate card**: three chips, `A ●`, a relation toggle cycling `— / ⊂ × \|`, `B ■`. It stops on **⊂**. | ● drops inside ■. | *Relate it.* |
| 0:50 | **Formula field**: a single pill. `(▲ ⊂ ●) / ■` types in, character by character. | The glyph rebuilds as each symbol lands, ending on **Agent**. | *Or just write it.* |
| 0:54 | **Palette swatches**: a row of five dots. One is tapped. | Ground, fill and ink shift from Reference to Yellow. The cards slide out of frame. | *Make it yours.* |

Cards enter and leave on the same spring as the glyphs, and never cover the glyph.

## Act 5 — Compounding (0:56–1:04)

Full frame again, no UI. **11 changes that speed up and build up.** Each morph keeps the shapes already on screen and adds to them, so a single shape grows into ever denser compounds. The beat starts at ~1 s and shortens each time to ~0.25 s; the name and formula at the bottom flicker past in step. The palette rotates as it goes: Yellow → Blue → Paper → Night.

| # | Glyph | Formula | Shapes |
|---|---|---|---|
| 1 | Circle | `●` | 1 |
| 2 | Matrix pair | `● — ▲` | 2 |
| 3 | **Chain** | `▲ — ● — ■` | 3 |
| 4 | **Pillar** | `(▲ / ■) — ●` | 3 |
| 5 | **Branch** | `● — {▲, ■}` | 3 |
| 6 | **Function** | `● — (▲ ⊂ ■) — ●` | 4 |
| 7 | **Hub** | `■ — {●, ●, ▲}` | 4 |
| 8 | **Context window** | `{●, ●, ▲} ⊂ ■` | 4 |
| 9 | **Feedback** | `▲ — ● — ■ — ▲` | 4 |
| 10 | **Tool call** | `(▲ ⊂ ●) — ■ — ●` | 4 |
| 11 | **Pipeline** | `■ — ▲ — ■ — ▲ — ●` | 5, the grammar's limit (lands on Night and holds) |

Music: a riser under the whole run, cut dead on #11. Caption over the hold: *Every idea, three shapes.*

## Act 6 — End card: the library (1:04–1:14)

| Time | Picture | Text |
|---|---|---|
| 1:04 | Pipeline sits alone, full frame, on Night. | — |
| 1:06 | **Zoom out.** Pipeline turns out to be one tile in a grid. More tiles come into view in rings around it, each a different compound in its own palette: the 12 reference compounds, the 38 topic compounds, then the 45 matrix pairs, ~95 glyphs in all. Every tile idles slightly out of phase (a small breathing spring), so the wall shimmers. | — |
| 1:10 | The zoom slows to a stop on the whole wall, which dims to ~35%. The wordmark settles in the centre over it. | **Glyph System Studio** · *Three shapes. Five relations.* · glyph-system-studio.netlify.app |
| 1:14 | Music resolves. Cut to black. | — |

The zoom is one continuous ease-out (no cuts), so the last glyph of Act 5 stays readable until it is just one cell among dozens.

---

## How we'd build it

- **One animation page in this repo** that reuses `lib/grammar.ts`, `lib/presets.ts` and `lib/formula.ts`, plays every scene on a timeline with the canvas spring, and renders frame-by-frame (deterministic time) in the pre-installed headless Chromium → PNG frames → `ffmpeg` to MP4 (H.264, 1080p30).
- **Act 4 UI pieces** are simplified React components built from the studio's own styles and shadcn parts, not screenshots, so they stay sharp and animate like the glyphs. The Act 3 reveal uses the same pieces at full detail before they come apart.
- **Act 6 wall** is drawn from the preset list in `lib/presets.ts`, so every glyph in it is a real preset.
- **Sound:** I can't compose music; the render will ship silent (or with a placeholder) and leave timed markers so a track and foley can be laid in.

## Open questions

1. Length: ~74 s as written, or a 30 s cut for social?
2. Captions only, or do you want a voiceover script too?
3. Keep the Agents & LLMs glyphs prominent, or lean more general (Design/Systems)?
4. Any palette or font you want the film to stay in throughout?

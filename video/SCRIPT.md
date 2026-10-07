# Glyph System Studio — launch film (30 s)

**Format:** 16:9, 1920 × 1080, 60 fps · **Runtime:** 30 s · **Sound:** none; captions carry the story
**Palette:** the studio's own: pastel grounds (Yellow `#FFF59D`, Green `#A5D6A7`, Blue `#81D4FA`, Pink `#F8BBD0`, Purple `#CE93D8`, Orange `#FFCC80`, Teal `#80CBC4`), white fill, ink `#020617`, hand-drawn wobble 3, stroke 1.8. UI pieces in the studio's neutral greys. Type: Inter, formulas in mono.

**Arc:** *Alphabet → Grammar → Tool → Compounds → Library.* Every cut is a morph: shapes never vanish, they move into the next glyph, on a spring a little bouncier than the canvas one (`stiffness 300, damping 20, mass 0.8`) so it reads on video.

## 1 · Alphabet (0:00–0:05) — Yellow
| Time | Glyph | Caption |
|---|---|---|
| 0:00 | A circle springs open, centred. | *A signal.* |
| 0:01.5 | Circle morphs into a triangle. | *A change.* |
| 0:02.7 | Triangle settles into a square. | *A structure.* |
| 0:03.9 | Square splits into ● ▲ ■. | *Three shapes.* |

## 2 · Grammar (0:05–0:11)
● and ■ act out each relation, one per second; the formula sits under the glyph.
`● — ■` *leads to* · `● / ■` *built on* · `● ⊂ ■` *part of* · `● × ■` *shared ground* · `● | ■` *derives from* → caption *Five relations.*

## 3 · The pieces (0:11–0:17)
Abstract studio UI cards float around the glyph and act on it, no cursor:
- **Toolbar pill** (● ▲ ■ buttons): each press springs a shape onto the ground. *Add shapes.*
- **Relate card** (`A ●` · relation toggle · `B ■`): the toggle cycles — / × and stops on ⊂; the glyph follows each step. *Relate them.*
- **Formula pill**: `(▲ ⊂ ●) / ■` types in; the glyph rebuilds per keystroke into **Agent**. *Or write it.*

## 4 · Compounds (0:17–0:24)
11 morphs, each faster than the last (1 s → 0.25 s), each adding density, ground rotating through the pastels. Name + formula flicker at the bottom.
Chain → Branch → Pillar → Eclipse → Lantern → Function → Hub → Context window → Tool call → Fan-out → **Pipeline** (5 shapes, the grammar's limit; holds). Caption: *Every idea, three shapes.*

## 5 · Library (0:24–0:30)
One continuous zoom out: Pipeline becomes one tile in a wall of ~100 presets (primitives, the 45 matrix pairs, all compounds) on the studio's grey workspace, each tile in its own pastel. Tiles breathe and keep morphing into other presets, so the wall is alive. The wall dims; wordmark settles in the centre:
**Glyph System Studio** · *Three shapes. Five relations.* · glyph-system-studio.netlify.app

## Build
`video/film.ts` renders any frame deterministically from the studio's own `lib/` (presets, `formulaToDoc`, `fromSpec`); `video/render.mjs` steps it in headless Chromium and pipes frames to ffmpeg → `video/out/glyph-system-studio.mp4`.

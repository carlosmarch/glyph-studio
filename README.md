# Glyph System Studio

Compose glyphs from three shapes and five relations, and watch them render live.

**Live:** [glyph-system-studio.netlify.app](https://glyph-system-studio.netlify.app/)

Glyph System Studio is a standalone editor for the shape grammar behind the writing glyphs on [carlosmarch.es](https://carlosmarch.es/playground/shape-grammar). Add shapes, relate them, drag them around, restyle them. The formula is read back from the canvas as you work, and the result exports as SVG or as an entry for the portfolio's `glyphs.ts`.

## The grammar

| Primitive | Symbol | Means |
|---|---|---|
| Circle | `●` | A signal: an idea, a topic, a point of attention |
| Triangle | `▲` | Change: something moving, acting or rising |
| Square | `■` | Structure: a framework, a rule, a base |

| Relation | Notation | Reads as |
|---|---|---|
| Connect | `A — B` | Leads to, works with (ink line, nodes at both ends) |
| Stack | `A / B` | Built on, depends on |
| Nest | `A ⊂ B` | Contains, is part of (A drawn in ink inside B) |
| Overlap | `A × B` | Shared ground (A outlined across B) |
| Anchor | `A \| B` | Flags, derives from (small A tethered above B) |

Fill carries the shape, ink carries the relation. At most 5 shapes, inside a 200 × 100 box.

## The workspace

Laid out like Figma:

- **Left panel** — the main menu (logo: File, Edit, View, Export), the glyph's name (click to rename), and **Layers** / **Assets** tabs. Layers lists the shapes topmost first; Assets holds your saved glyphs and the presets.
- **Canvas** — the formula on top (click it to type one), the glyph on a grey workspace with its name on the top-left corner (click to rename), and a floating toolbar at the bottom: add circle, triangle or square, random glyph, clear, undo and redo. Click empty workspace to deselect. The `?` button lists the shortcuts.
- **Right panel** — Save and Share up top, then **Design** (the selected shape's primitive, role and X/Y/W/H — drag a letter to scrub — then palette, colours, stroke, canvas and export) and **Relate**.

## What you can do

- **Shape** — add circles, triangles and squares; change primitive, role (body, outline, nested mark), position and size. Drag on the canvas; a body carries its nested marks.
- **Relate** — pick A, a relation and B. B stays put and A is re-placed so the pair reads as that relation. The panel lists every relation the grammar reads off the canvas.
- **Style** — palettes (the reference, the portfolio pastels, Paper, Night), custom ground/fill/ink, hand-drawn wobble, ink stroke and wobble seed.
- **Presets** — the 3 primitives, any of the 45 matrix pairs (9 ordered pairs × 5 relations), the 12 reference compounds (Chain, Pillar, Totem, Core link, Branch, Hub, Shelter, Eclipse, Beacon, Lantern, Keystone, Relay), and 38 topic compounds shelved by theme — Design (token tiers, atomic design, theming…), Code, Systems, Agents & LLMs (context window, retrieval, tool call, skill…), Writing (outline, thesis, citation, revision…), Research (experiment, synthesis, triangulation…), Nature and Culture. Filter the shelf by topic.
- **Live formula** — the glyph written in notation and grouped the way you type it (`▲ | (○ × ■) — ●`), with the same rule checks the portfolio build runs.
- **Type a formula** — click the formula and write one; the canvas builds it as you type. `Enter` keeps it, `Esc` puts the canvas back. An insert bar types the symbols for you, or use ASCII: `c t s` for shapes, `- / < x |` for relations. Group with `( )`, fan out with `{ }`, separate parts with `·` or `,`. Stack, nest, overlap and anchor bind tighter than connect: `● — ▲ / ■` reads as `● — (▲ / ■)`.
- **Random glyph** — `R` builds a 2–5 shape formula (relations, groups, fans, loops, outlined nodes, separate parts) and composes it freely: shape sizes and proportions, line lengths and angles, where a stacked, nested or anchored shape sits, and the glyph's size and place in the box all vary. A layout is kept only if it still reads back as the same formula and nothing collides that the grammar didn't ask to.
- **Undo/redo**, keyboard nudging, and a **share link**: the whole glyph lives in the URL hash.
- **Export** — download or copy SVG, or copy a ready-to-paste `glyphs.ts` entry.

## Keyboard

| Key | Action |
|---|---|
| `⌘Z` / `⇧⌘Z` (`Ctrl` on Windows/Linux) | Undo / redo |
| `C` / `T` / `S` | Add a circle / triangle / square |
| `R` | Random glyph |
| `⌘S` | Save |
| Arrow keys (`⇧` for ×5) | Nudge the selected shape |
| `⌫` / `Delete` | Delete the selected shape |
| `Esc` | Deselect |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · [shadcn/ui](https://ui.shadcn.com) (new-york, neutral) on Radix · [Motion](https://motion.dev) for the live canvas: springs between states, enter/exit, and line drawing. Motion respects `prefers-reduced-motion`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run lint
```

Deploys on Netlify as-is: `netlify.toml` sets the build command, `dist/` as the publish folder and Node 22. Import the repo in Netlify and keep the defaults.

Add more shadcn components with `npx shadcn@latest add <component>` — `components.json` is set up.

## Layout

```
src/
  lib/grammar.ts       model, relations, inference → formula, validation, GlyphSpec in/out
  lib/formula.ts       formula parser + layout (notation → glyph)
  lib/presets.ts       palettes, primitives, matrix pairs, compounds
  lib/export.ts        SVG, glyphs.ts snippet, share-link encoding
  hooks/use-history.ts undo/redo with transient updates for dragging
  components/glyph-canvas.tsx  live Motion canvas + static thumbnails
  components/panels/   Layers, Shape, Relate, Style, Presets, Saved
  components/ui/       shadcn/ui components
```

## Portfolio interop

`toSpec()` and `fromSpec()` use the same `GlyphSpec` shape as the portfolio's `src/content/glyphs.ts`:

```ts
{ f: SpecShape[]; o: SpecShape[]; k: SpecShape[]; l: SpecLine[] }  // fill · outline · ink · lines
```

**Export → Copy glyphs.ts entry** gives you an entry to paste in. Fill in its `reading`, and the portfolio's `check-glyphs` validates it on the next build.

import { center, fromSpec, type Doc, type GlyphSpec, type Kind, type RelationKind, type SpecLine, type SpecShape } from "./grammar"

// —— Palettes ——————————————————————————————————————————————————

export interface Style {
  ground: string
  fill: string
  ink: string
  /** Hand-drawn displacement, in glyph units. */
  wobble: number
  stroke: number
  seed: number
}

export interface Palette {
  name: string
  ground: string
  fill: string
  ink: string
}

export const PALETTES: Palette[] = [
  { name: "Reference", ground: "#F2E9E9", fill: "#EB5D36", ink: "#341424" },
  { name: "Yellow", ground: "#FFF59D", fill: "#FFFFFF", ink: "#020617" },
  { name: "Green", ground: "#A5D6A7", fill: "#FFFFFF", ink: "#020617" },
  { name: "Blue", ground: "#81D4FA", fill: "#FFFFFF", ink: "#020617" },
  { name: "Pink", ground: "#F8BBD0", fill: "#FFFFFF", ink: "#020617" },
  { name: "Purple", ground: "#CE93D8", fill: "#FFFFFF", ink: "#020617" },
  { name: "Orange", ground: "#FFCC80", fill: "#FFFFFF", ink: "#020617" },
  { name: "Teal", ground: "#80CBC4", fill: "#FFFFFF", ink: "#020617" },
  { name: "Paper", ground: "#F5F4EF", fill: "#D6D0D3", ink: "#341424" },
  { name: "Night", ground: "#0F172A", fill: "#F8FAFC", ink: "#FBBF24" },
]

export const DEFAULT_STYLE: Style = { ...PALETTES[1], wobble: 3, stroke: 1.8, seed: 7 }

// —— Primitives, matrix pairs and compounds ———————————————————————————

const link = (a: SpecShape, b: SpecShape): SpecLine => {
  const [x1, y1] = center({ kind: a[0], x: a[1], y: a[2], w: a[3], h: a[4] })
  const [x2, y2] = center({ kind: b[0], x: b[1], y: b[2], w: b[3], h: b[4] })
  return [x1, y1, x2, y2]
}

export interface Preset {
  name: string
  formula: string
  reading: string
  spec: GlyphSpec
}

export const PRIMITIVES: Preset[] = [
  { name: "Circle", formula: "●", reading: "A signal. An idea, a topic, a point of attention.", spec: { f: [["circle", 72, 22, 56, 56]] } },
  { name: "Triangle", formula: "▲", reading: "Change. Something moving, acting or rising.", spec: { f: [["triangle", 70, 22, 60, 54]] } },
  { name: "Square", formula: "■", reading: "Structure. A framework, a rule, a base.", spec: { f: [["square", 74, 24, 52, 52]] } },
]

/** The reference layout for A <relation> B, centred in the box — one cell of the 45-glyph matrix. */
export function pairSpec(kind: RelationKind, a: Kind, b: Kind): GlyphSpec {
  if (kind === "connect") {
    const A: SpecShape = [a, 56, 32, 36, 36]
    const B: SpecShape = [b, 108, 32, 36, 36]
    return { f: [A, B], l: [link(A, B)] }
  }
  if (kind === "stack") return { f: [[a, 83, 10, 34, 34], [b, 80, 47, 40, 42]] }
  if (kind === "nest") {
    const inner: SpecShape = b === "triangle" ? [a, 89, 54, 22, 22] : [a, 88, 38, 24, 24]
    return { f: [[b, 66, 16, 68, 68]], k: [inner] }
  }
  if (kind === "overlap") return { f: [[b, 88, 26, 48, 48]], o: [[a, 64, 26, 48, 48]] }
  const small: SpecShape = [a, 90, 6, 20, 20]
  const large: SpecShape = [b, 78, 50, 44, 42]
  return { f: [small, large], l: [link(small, large)] }
}

function chain(...shapes: SpecShape[]): GlyphSpec {
  return { f: shapes, l: shapes.slice(1).map((s, i) => link(shapes[i], s)) }
}

export const COMPOUNDS: Preset[] = (() => {
  let C: SpecShape, C2: SpecShape, S: SpecShape, T: SpecShape
  const out: Preset[] = []
  T = ["triangle", 10, 34, 34, 32]; C = ["circle", 84, 34, 32, 32]; S = ["square", 158, 34, 32, 32]
  out.push({ name: "Chain", formula: "▲ — ● — ■", reading: "A sequence. Cause, signal, response.", spec: chain(T, C, S) })
  T = ["triangle", 30, 10, 36, 34]; S = ["square", 28, 47, 40, 40]; C = ["circle", 130, 47, 40, 40]
  out.push({ name: "Pillar", formula: "(▲ / ■) — ●", reading: "A built thing linked to the signal it answers.", spec: { f: [T, S, C], l: [link(S, C)] } })
  C = ["circle", 90, 4, 20, 20]; T = ["triangle", 82, 26, 36, 30]; S = ["square", 80, 58, 40, 38]
  out.push({ name: "Totem", formula: "● / ▲ / ■", reading: "Three layers stacked. A hierarchy read top-down.", spec: { f: [C, T, S] } })
  S = ["square", 24, 22, 56, 56]; T = ["triangle", 128, 30, 44, 40]
  out.push({ name: "Core link", formula: "(● ⊂ ■) — ▲", reading: "A contained signal pointing to a change.", spec: { f: [S, T], k: [["circle", 40, 38, 24, 24]], l: [link(S, T)] } })
  C = ["circle", 18, 34, 32, 32]; T = ["triangle", 140, 8, 34, 30]; S = ["square", 142, 62, 30, 30]
  out.push({ name: "Branch", formula: "● — {▲, ■}", reading: "One source, two outcomes.", spec: { f: [C, T, S], l: [link(C, T), link(C, S)] } })
  S = ["square", 82, 32, 36, 36]; C = ["circle", 20, 10, 26, 26]; C2 = ["circle", 28, 68, 20, 20]; T = ["triangle", 154, 32, 34, 30]
  out.push({ name: "Hub", formula: "■ — {●, ●, ▲}", reading: "A structure that gathers many signals.", spec: { f: [S, C, C2, T], l: [link(S, C), link(S, C2), link(S, T)] } })
  T = ["triangle", 62, 12, 76, 37]
  out.push({ name: "Shelter", formula: "(● ⊂ ▲) / (■ ■)", reading: "A shared roof over two bases.", spec: { f: [T, ["square", 66, 52, 32, 40], ["square", 102, 52, 32, 40]], k: [["circle", 93, 30, 14, 14]] } })
  S = ["square", 96, 38, 50, 50]; C = ["circle", 62, 26, 50, 50]; T = ["triangle", 164, 6, 22, 20]
  out.push({ name: "Eclipse", formula: "▲ | (● × ■)", reading: "A flag raised over shared ground.", spec: { f: [S, T], o: [C], l: [link(T, S)] } })
  T = ["triangle", 82, 6, 36, 34]; C = ["circle", 74, 44, 52, 52]
  out.push({ name: "Beacon", formula: "▲ / (▲ ⊂ ●)", reading: "A change rising from a change held inside a signal.", spec: { f: [T, C], k: [["triangle", 88, 58, 24, 22]] } })
  C = ["circle", 88, 4, 24, 24]; S = ["square", 74, 30, 52, 62]
  out.push({ name: "Lantern", formula: "● / (▲ ⊂ ■)", reading: "A signal carried on a structure that holds a change.", spec: { f: [C, S], k: [["triangle", 88, 50, 24, 24]] } })
  S = ["square", 86, 6, 28, 28]; T = ["triangle", 64, 36, 72, 60]
  out.push({ name: "Keystone", formula: "■ / (● ⊂ ▲)", reading: "A structure set on a change that contains a signal.", spec: { f: [S, T], k: [["circle", 90, 70, 20, 20]] } })
  T = ["triangle", 38, 6, 36, 34]; C = ["circle", 30, 44, 52, 52]; C2 = ["circle", 140, 54, 32, 32]
  out.push({ name: "Relay", formula: "(▲ / (▲ ⊂ ●)) — ●", reading: "A Beacon passing its signal on to the next.", spec: { f: [T, C, C2], k: [["triangle", 44, 58, 24, 22]], l: [link(C, C2)] } })
  return out
})()

export const STARTER: Doc = fromSpec(COMPOUNDS[7].spec)

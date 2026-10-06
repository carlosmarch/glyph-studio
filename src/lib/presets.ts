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
  /** Compounds only: the topic shelf it sits on in the Presets panel. */
  theme?: CompoundTheme
}

export const COMPOUND_THEMES = ["Reference", "Design", "Code", "Systems", "Agents & LLMs", "Nature", "Culture"] as const
export type CompoundTheme = (typeof COMPOUND_THEMES)[number]

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

const REFERENCE: Preset[] = (() => {
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
  return out.map((p) => ({ ...p, theme: "Reference" as const }))
})()

/** Topic compounds — the same grammar applied to what the writing is about. */
const TOPICS: Preset[] = (() => {
  let A: SpecShape, B: SpecShape, C: SpecShape, D: SpecShape, E: SpecShape
  const out: Preset[] = []
  const add = (theme: CompoundTheme, name: string, formula: string, reading: string, spec: GlyphSpec) =>
    out.push({ name, formula, reading, spec, theme })

  // Design
  A = ["circle", 14, 66, 22, 22]; B = ["square", 62, 52, 30, 30]; C = ["square", 132, 8, 52, 52]
  add("Design", "Token tiers", "● — ■ — ■", "A raw value, aliased up: primitive, semantic, component.", chain(A, B, C))
  A = ["circle", 10, 58, 18, 18]; B = ["square", 50, 14, 40, 40]; C = ["square", 118, 10, 74, 80]
  add("Design", "Atomic", "● — (● ⊂ ■) — (■ ⊂ ■)", "Atom, molecule, organism. Each level frames the last.", {
    f: [A, B, C], k: [["circle", 62, 26, 16, 16], ["square", 140, 35, 30, 30]], l: [link(A, B), link(B, C)],
  })
  add("Design", "Variant", "□ × (● ⊂ ■)", "One component and a variant drawn across it. Same core, shifted surface.", {
    f: [["square", 92, 24, 52, 52]], o: [["square", 56, 24, 52, 52]], k: [["circle", 109, 41, 18, 18]],
  })
  add("Design", "Theming", "(○ × ●) / ■", "Two modes sharing one slot, set on the same structure.", {
    f: [["circle", 90, 6, 40, 40], ["square", 62, 50, 76, 44]], o: [["circle", 70, 6, 40, 40]],
  })
  A = ["circle", 12, 8, 26, 26]; B = ["triangle", 66, 18, 44, 42]; C = ["square", 134, 40, 52, 52]
  add("Design", "Draft", "○ — △ — ■", "Idea, sketch, build. The outlines turn solid only at the end.", { f: [C], o: [A, B], l: [link(A, B), link(B, C)] })
  A = ["triangle", 14, 72, 18, 16]; B = ["triangle", 64, 34, 32, 30]; C = ["triangle", 128, 4, 60, 56]
  add("Design", "Iteration", "▲ — ▲ — ▲", "Each pass builds on the last and climbs a little higher.", chain(A, B, C))

  // Code
  A = ["circle", 14, 8, 20, 20]; B = ["square", 70, 14, 60, 62]; C = ["circle", 162, 66, 24, 24]
  add("Code", "Function", "● — (▲ ⊂ ■) — ●", "Input, a contained transformation, output.", {
    f: [A, B, C], k: [["triangle", 88, 34, 24, 22]], l: [link(A, B), link(B, C)],
  })
  add("Code", "Dependencies", "■ / ■ / ■", "Each layer built on the one below. Pull one out and everything above moves.", {
    f: [["square", 86, 4, 28, 24], ["square", 78, 31, 44, 28], ["square", 68, 62, 64, 34]],
  })
  A = ["triangle", 16, 10, 28, 26]; B = ["square", 66, 18, 48, 48]; C = ["circle", 150, 8, 26, 26]; D = ["circle", 160, 60, 30, 30]
  add("Code", "Pub/sub", "▲ — ■ — {●, ●}", "One event, broadcast through a channel to everyone listening.", {
    f: [A, B, C, D], l: [link(A, B), link(B, C), link(B, D)],
  })

  // Systems
  A = ["triangle", 18, 6, 26, 24]; B = ["square", 66, 16, 62, 62]; C = ["triangle", 150, 62, 30, 28]
  add("Systems", "Stock & flow", "▲ — ■ — ▲", "Inflow, a stock that accumulates, outflow.", chain(A, B, C))
  A = ["triangle", 82, 6, 36, 32]; B = ["circle", 128, 58, 32, 32]; C = ["square", 40, 58, 32, 32]
  add("Systems", "Feedback", "▲ — ● — ■ — ▲", "Action makes a signal, the signal reshapes structure, structure steers the next action.", {
    f: [A, B, C], l: [link(A, B), link(B, C), link(C, A)],
  })
  A = ["square", 8, 10, 62, 62]; B = ["square", 88, 38, 26, 26]; C = ["square", 134, 46, 50, 46]
  add("Systems", "Interface", "■ — □ — ■", "Two systems meeting at a contract neither of them owns.", { f: [A, C], o: [B], l: [link(A, B), link(B, C)] })
  add("Systems", "Platform", "{▲, ▲, ▲} / ■", "Many products standing on one shared base.", {
    f: [["triangle", 34, 30, 32, 30], ["triangle", 84, 30, 32, 30], ["triangle", 134, 30, 32, 30], ["square", 20, 63, 160, 32]],
  })
  A = ["square", 6, 14, 22, 22]; B = ["triangle", 44, 52, 26, 24]; C = ["square", 86, 18, 24, 24]; D = ["triangle", 126, 54, 26, 24]; E = ["circle", 160, 10, 34, 34]
  add("Systems", "Pipeline", "■ — ▲ — ■ — ▲ — ●", "Store, transform, store, transform, until it surfaces as insight.", chain(A, B, C, D, E))

  // Agents & LLMs
  A = ["square", 10, 62, 20, 20]; B = ["square", 50, 34, 22, 22]; C = ["square", 96, 18, 24, 24]; D = ["circle", 148, 26, 40, 40]
  add("Agents & LLMs", "Next token", "■ — ■ — ■ — ○", "The tokens laid down so far, and the unwritten one the model predicts next.", { f: [A, B, C], o: [D], l: [link(A, B), link(B, C), link(C, D)] })
  add("Agents & LLMs", "Context window", "{●, ●, ▲} ⊂ ■", "Everything the model can see at once, held in one frame.", {
    f: [["square", 30, 14, 140, 72]], k: [["circle", 46, 30, 30, 30], ["circle", 90, 52, 16, 16], ["triangle", 122, 26, 30, 28]],
  })
  A = ["square", 10, 30, 62, 62]; B = ["circle", 124, 6, 58, 58]
  add("Agents & LLMs", "Retrieval", "(● ⊂ ■) — (▲ ⊂ ●)", "Knowledge pulled up from a store into the model that acts on it.", {
    f: [A, B], k: [["circle", 31, 51, 20, 20], ["triangle", 141, 23, 24, 22]], l: [link(A, B)],
  })
  add("Agents & LLMs", "Agent", "(▲ ⊂ ●) / ■", "A model that acts, standing on the harness that runs it.", {
    f: [["circle", 74, 4, 52, 52], ["square", 66, 60, 68, 36]], k: [["triangle", 88, 18, 24, 22]],
  })
  A = ["circle", 8, 10, 60, 60]; B = ["square", 92, 62, 28, 28]; C = ["circle", 156, 14, 22, 22]
  add("Agents & LLMs", "Tool call", "(▲ ⊂ ●) — ■ — ●", "An agent reaches down for a tool; a result comes back up as signal.", {
    f: [A, B, C], k: [["triangle", 26, 30, 24, 22]], l: [link(A, B), link(B, C)],
  })
  A = ["circle", 14, 20, 60, 60]; B = ["triangle", 112, 12, 22, 20]; C = ["triangle", 158, 32, 30, 28]; D = ["triangle", 110, 70, 24, 22]
  add("Agents & LLMs", "Fan-out", "(▲ ⊂ ●) — {▲, ▲, ▲}", "One agent splits the work and hands it to others.", {
    f: [A, B, C, D], k: [["triangle", 32, 42, 24, 22]], l: [link(A, B), link(A, C), link(A, D)],
  })
  A = ["circle", 90, 4, 20, 20]; B = ["square", 70, 40, 60, 56]
  add("Agents & LLMs", "Skill", "● | (▲ ⊂ ■)", "A named trigger, tethered to the packaged know-how it unlocks.", {
    f: [A, B], k: [["triangle", 88, 54, 24, 22]], l: [link(A, B)],
  })

  // Nature
  add("Nature", "Sprout", "▲ / (● ⊂ ■)", "A shoot rising from a seed held in the ground.", {
    f: [["triangle", 84, 8, 32, 30], ["square", 60, 41, 80, 54]], k: [["circle", 90, 58, 20, 20]],
  })
  add("Nature", "Pine", "▲ / ▲ / ■", "Growth layered on growth, rooted in one trunk.", {
    f: [["triangle", 84, 4, 32, 28], ["triangle", 74, 35, 52, 40], ["square", 92, 78, 16, 18]],
  })
  A = ["circle", 22, 62, 16, 16]; B = ["circle", 62, 14, 20, 20]; C = ["circle", 150, 22, 14, 14]; D = ["circle", 122, 70, 18, 18]
  add("Nature", "Constellation", "● — ● — ● — ● — ●", "Separate lights, read together as one closed figure.", { ...chain(A, B, C, D), l: [...chain(A, B, C, D).l!, link(D, A)] })

  // Culture
  add("Culture", "Commons", "{○, ○} × ●", "Shared ground, held by everyone who overlaps it.", {
    f: [["circle", 72, 22, 56, 56]], o: [["circle", 44, 22, 56, 56], ["circle", 100, 22, 56, 56]],
  })
  A = ["circle", 8, 6, 56, 56]; B = ["circle", 92, 40, 30, 30]; C = ["circle", 156, 72, 16, 16]
  add("Culture", "Echo", "● — ● — ○", "An idea retold until only its outline remains.", { f: [A, B], o: [C], l: [link(A, B), link(B, C)] })
  A = ["triangle", 100, 4, 92, 90]; B = ["circle", 8, 8, 18, 18]; C = ["circle", 14, 62, 28, 28]; D = ["circle", 56, 40, 14, 14]
  add("Culture", "Movement", "▲ — {●, ●, ●}", "Many voices joined into one change.", {
    f: [A, B, C, D], l: [link(A, B), link(A, C), link(A, D)],
  })
  return out
})()

export const COMPOUNDS: Preset[] = [...REFERENCE, ...TOPICS]

export const STARTER: Doc = fromSpec(COMPOUNDS[7].spec)

/**
 * Shape grammar — three primitives, five relations.
 *
 * Same geometry and spec format as the portfolio's writing glyphs
 * (carlosmarch.es/playground/shape-grammar), so a glyph composed here can be
 * pasted into `src/content/glyphs.ts` as-is.
 */

export type Kind = "circle" | "triangle" | "square"
/** fill = body · outline = overlapping shape · ink = nested mark */
export type Role = "fill" | "outline" | "ink"
export type RelationKind = "connect" | "stack" | "nest" | "overlap" | "anchor"

export interface Shape {
  id: string
  kind: Kind
  role: Role
  x: number
  y: number
  w: number
  h: number
}

/** A relation line between two shapes (connect / anchor), drawn centre to centre. */
export interface Link {
  id: string
  a: string
  b: string
}

export interface Doc {
  shapes: Shape[]
  links: Link[]
}

export const BOX_W = 200
export const BOX_H = 100
export const MAX_SHAPES = 5
export const MIN_SIZE = 6

export const KINDS: Kind[] = ["circle", "triangle", "square"]

export const KIND_META: Record<Kind, { name: string; symbol: string; hollow: string; meaning: string }> = {
  circle: { name: "Circle", symbol: "●", hollow: "○", meaning: "A signal. An idea, a topic, a point of attention." },
  triangle: { name: "Triangle", symbol: "▲", hollow: "△", meaning: "Change. Something moving, acting or rising." },
  square: { name: "Square", symbol: "■", hollow: "□", meaning: "Structure. A framework, a rule, a base." },
}

export const RELATIONS: RelationKind[] = ["connect", "stack", "nest", "overlap", "anchor"]

export const RELATION_META: Record<RelationKind, { name: string; op: string; reads: string }> = {
  connect: { name: "Connect", op: "—", reads: "Peers joined centre to centre. Leads to, works with." },
  stack: { name: "Stack", op: "/", reads: "A rests on B. Built on, depends on." },
  nest: { name: "Nest", op: "⊂", reads: "A inside B, drawn in ink. Contains, is part of." },
  overlap: { name: "Overlap", op: "×", reads: "A outlined across B. Shared ground." },
  anchor: { name: "Anchor", op: "|", reads: "A small A tethered above B. Flags, derives from." },
}

// —— Geometry ————————————————————————————————————————————————

export function shapePath(kind: Kind, x: number, y: number, w: number, h: number): string {
  if (kind === "circle") {
    const rx = w / 2
    const ry = h / 2
    return `M${x} ${y + ry}a${rx} ${ry} 0 1 0 ${w} 0a${rx} ${ry} 0 1 0 ${-w} 0Z`
  }
  if (kind === "square") return `M${x} ${y}h${w}v${h}h${-w}Z`
  return `M${x + w / 2} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`
}

/** Visual centre — a triangle's sits low, near its centroid. */
export function center(s: Pick<Shape, "kind" | "x" | "y" | "w" | "h">): [number, number] {
  return [s.x + s.w / 2, s.y + s.h * (s.kind === "triangle" ? 0.64 : 0.5)]
}

const area = (s: Shape) => s.w * s.h
const round = (n: number) => Math.round(n * 10) / 10

function contains(outer: Shape, inner: Shape, tolerance = 1) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  )
}

function intersects(a: Shape, b: Shape) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function clampShape(s: Shape): Shape {
  const w = Math.min(Math.max(s.w, MIN_SIZE), BOX_W)
  const h = Math.min(Math.max(s.h, MIN_SIZE), BOX_H)
  return {
    ...s,
    w,
    h,
    x: round(Math.min(Math.max(s.x, 0), BOX_W - w)),
    y: round(Math.min(Math.max(s.y, 0), BOX_H - h)),
  }
}

export function shapeLabel(doc: Doc, s: Shape) {
  return `${doc.shapes.indexOf(s) + 1} · ${s.role === "outline" ? "Outlined " + KIND_META[s.kind].name.toLowerCase() : KIND_META[s.kind].name}`
}

// —— Editing ——————————————————————————————————————————————————

let counter = 0
export const newId = (prefix = "s") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`

export function addShape(doc: Doc, kind: Kind, id = newId()): { doc: Doc; id: string } {
  const size = 36
  // Place it in the emptiest third of the box.
  const slots = [32, 100, 168]
  const crowd = (cx: number) => doc.shapes.filter((s) => Math.abs(center(s)[0] - cx) < 34).length
  const cx = slots.reduce((best, slot) => (crowd(slot) < crowd(best) ? slot : best), slots[1])
  const shape: Shape = clampShape({
    id,
    kind,
    role: "fill",
    x: cx - size / 2,
    y: 50 - size / 2,
    w: size,
    h: size,
  })
  return { doc: { ...doc, shapes: [...doc.shapes, shape] }, id: shape.id }
}

export function updateShape(doc: Doc, id: string, patch: Partial<Omit<Shape, "id">>): Doc {
  return {
    ...doc,
    shapes: doc.shapes.map((s) => (s.id === id ? clampShape({ ...s, ...patch }) : s)),
  }
}

export function removeShape(doc: Doc, id: string): Doc {
  return {
    shapes: doc.shapes.filter((s) => s.id !== id),
    links: doc.links.filter((l) => l.a !== id && l.b !== id),
  }
}

export function duplicateShape(doc: Doc, id: string, copyId = newId()): { doc: Doc; id: string } | null {
  const s = doc.shapes.find((x) => x.id === id)
  if (!s) return null
  const copy = clampShape({ ...s, id: copyId, x: s.x + 12, y: s.y + 6 })
  return { doc: { ...doc, shapes: [...doc.shapes, copy] }, id: copy.id }
}

/** Bring a shape to the front of its role's layer. */
export function bringToFront(doc: Doc, id: string): Doc {
  const s = doc.shapes.find((x) => x.id === id)
  if (!s) return doc
  return { ...doc, shapes: [...doc.shapes.filter((x) => x.id !== id), s] }
}

const linked = (doc: Doc, a: string, b: string) =>
  doc.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))

function withLink(doc: Doc, a: string, b: string): Doc {
  return linked(doc, a, b) ? doc : { ...doc, links: [...doc.links, { id: newId("l"), a, b }] }
}

function withoutLink(doc: Doc, a: string, b: string): Doc {
  return { ...doc, links: doc.links.filter((l) => !((l.a === a && l.b === b) || (l.a === b && l.b === a))) }
}

export function removeLink(doc: Doc, id: string): Doc {
  return { ...doc, links: doc.links.filter((l) => l.id !== id) }
}

/** Move a group of shapes back inside the box if a relation pushed them out. */
function fitGroup(doc: Doc, ids: string[]): Doc {
  const group = doc.shapes.filter((s) => ids.includes(s.id))
  const minX = Math.min(...group.map((s) => s.x))
  const minY = Math.min(...group.map((s) => s.y))
  const maxX = Math.max(...group.map((s) => s.x + s.w))
  const maxY = Math.max(...group.map((s) => s.y + s.h))
  const dx = minX < 0 ? -minX : maxX > BOX_W ? BOX_W - maxX : 0
  const dy = minY < 0 ? -minY : maxY > BOX_H ? BOX_H - maxY : 0
  if (!dx && !dy) return doc
  return {
    ...doc,
    shapes: doc.shapes.map((s) => (ids.includes(s.id) ? clampShape({ ...s, x: s.x + dx, y: s.y + dy }) : s)),
  }
}

/**
 * Relate A to B. B stays where it is; A is re-placed (and re-roled) so the
 * pair reads as the relation. Same proportions as the grammar's reference matrix.
 */
export function applyRelation(doc: Doc, kind: RelationKind, aId: string, bId: string): Doc {
  const a = doc.shapes.find((s) => s.id === aId)
  const b = doc.shapes.find((s) => s.id === bId)
  if (!a || !b || a.id === b.id) return doc
  const [bcx, bcy] = center(b)
  let next: Partial<Shape> = {}
  let bNext: Partial<Shape> = {}
  let out = withoutLink(doc, aId, bId)

  if (kind === "connect") {
    const gap = 16
    const left = b.x - gap - a.w
    const x = left >= 0 ? left : b.x + b.w + gap
    next = { role: "fill", x, y: bcy - a.h * (a.kind === "triangle" ? 0.64 : 0.5) }
    bNext = { role: "fill" }
    out = withLink(out, aId, bId)
  } else if (kind === "stack") {
    const w = Math.min(a.w, b.w * 0.9)
    const h = a.h * (w / a.w)
    next = { role: "fill", w, h, x: bcx - w / 2, y: b.y - h - 3 }
    bNext = { role: "fill" }
  } else if (kind === "nest") {
    const size = Math.min(b.w, b.h) * (b.kind === "triangle" ? 0.32 : 0.36)
    const cy = b.kind === "triangle" ? b.y + b.h * 0.68 : bcy
    next = { role: "ink", w: size, h: size, x: bcx - size / 2, y: cy - size / 2 }
    bNext = { role: "fill" }
  } else if (kind === "overlap") {
    next = { role: "outline", w: b.w, h: b.h, x: b.x - b.w * 0.5, y: b.y }
    bNext = { role: "fill" }
  } else {
    const size = Math.max(MIN_SIZE, Math.min(b.w, b.h) * 0.45)
    next = { role: "fill", w: size, h: size, x: bcx - size / 2, y: b.y - size - 22 }
    bNext = { role: "fill" }
    out = withLink(out, aId, bId)
  }

  out = {
    ...out,
    shapes: out.shapes.map((s) => {
      if (s.id === aId) return { ...s, ...next }
      if (s.id === bId) return { ...s, ...bNext }
      return s
    }),
  }
  return fitGroup(out, [aId, bId])
}

// —— Reading the canvas back as grammar ——————————————————————————

export interface InferredRelation {
  kind: RelationKind
  a: string
  b: string
  linkId?: string
}

/** Relations implied by what's on the canvas: lines, nesting, outlines and stacking. */
export function inferRelations(doc: Doc): InferredRelation[] {
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  const fills = doc.shapes.filter((s) => s.role === "fill")
  const out: InferredRelation[] = []

  for (const l of doc.links) {
    const a = byId.get(l.a)
    const b = byId.get(l.b)
    if (!a || !b) continue
    const aAbove = center(a)[1] < b.y && area(a) <= area(b) * 0.45
    const bAbove = center(b)[1] < a.y && area(b) <= area(a) * 0.45
    if (aAbove) out.push({ kind: "anchor", a: a.id, b: b.id, linkId: l.id })
    else if (bAbove) out.push({ kind: "anchor", a: b.id, b: a.id, linkId: l.id })
    else out.push({ kind: "connect", a: a.id, b: b.id, linkId: l.id })
  }

  for (const k of doc.shapes.filter((s) => s.role === "ink")) {
    const parent = fills
      .filter((p) => contains(p, k))
      .sort((p, q) => area(p) - area(q))[0]
    if (parent) out.push({ kind: "nest", a: k.id, b: parent.id })
  }

  for (const o of doc.shapes.filter((s) => s.role === "outline")) {
    const ground = fills.find((p) => intersects(o, p))
    if (ground) out.push({ kind: "overlap", a: o.id, b: ground.id })
  }

  for (const a of fills) {
    for (const b of fills) {
      if (a === b || linked(doc, a.id, b.id)) continue
      const gap = b.y - (a.y + a.h)
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      if (gap >= -1 && gap <= 8 && overlapX >= Math.min(a.w, b.w) * 0.4) {
        out.push({ kind: "stack", a: a.id, b: b.id })
      }
    }
  }
  return out
}

function symbol(s: Shape) {
  return s.role === "outline" ? KIND_META[s.kind].hollow : KIND_META[s.kind].symbol
}

/**
 * The glyph written in the grammar's notation. Chains of the same relation
 * merge (`● — ▲ — ■`); unrelated shapes stand alone.
 */
export function formula(doc: Doc): string {
  if (!doc.shapes.length) return ""
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  const relations = inferRelations(doc)
  const clauses: { kind: RelationKind; seq: string[] }[] = relations.map((r) => ({ kind: r.kind, seq: [r.a, r.b] }))

  // Merge clauses of the same relation end-to-start (connect may also flip).
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < clauses.length; i++) {
      for (let j = 0; j < clauses.length; j++) {
        if (i === j || clauses[i].kind !== clauses[j].kind) continue
        const x = clauses[i]
        let y = clauses[j]
        if (x.kind === "nest" || x.kind === "overlap") continue
        if (x.kind === "connect" && x.seq[x.seq.length - 1] !== y.seq[0] && x.seq[x.seq.length - 1] === y.seq[y.seq.length - 1]) {
          y = { ...y, seq: [...y.seq].reverse() }
        }
        if (x.seq[x.seq.length - 1] === y.seq[0]) {
          x.seq = [...x.seq, ...y.seq.slice(1)]
          clauses.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }

  const used = new Set(relations.flatMap((r) => [r.a, r.b]))
  const parts = clauses.map((c) =>
    c.seq.map((id) => symbol(byId.get(id)!)).join(` ${RELATION_META[c.kind].op} `),
  )
  for (const s of doc.shapes) if (!used.has(s.id)) parts.push(symbol(s))
  return parts.join("  ·  ")
}

// —— Rules (same as the portfolio's check-glyphs) ———————————————————

export interface Issue {
  level: "error" | "warning"
  message: string
}

export function validate(doc: Doc): Issue[] {
  const issues: Issue[] = []
  if (!doc.shapes.length) issues.push({ level: "warning", message: "Empty canvas — add a shape or pick a preset." })
  if (doc.shapes.length > MAX_SHAPES) {
    issues.push({ level: "error", message: `${doc.shapes.length} shapes — the grammar allows ${MAX_SHAPES}.` })
  }
  for (const s of doc.shapes) {
    if (s.x < 0 || s.y < 0 || s.x + s.w > BOX_W || s.y + s.h > BOX_H) {
      issues.push({ level: "error", message: `${KIND_META[s.kind].name} leaves the 200 × 100 box.` })
    }
  }
  const relations = inferRelations(doc)
  for (const s of doc.shapes) {
    if (s.role === "ink" && !relations.some((r) => r.kind === "nest" && r.a === s.id)) {
      issues.push({ level: "warning", message: `Ink ${KIND_META[s.kind].name.toLowerCase()} isn't nested inside a body.` })
    }
    if (s.role === "outline" && !relations.some((r) => r.kind === "overlap" && r.a === s.id)) {
      issues.push({ level: "warning", message: `Outlined ${KIND_META[s.kind].name.toLowerCase()} doesn't overlap a body.` })
    }
  }
  return issues
}

// —— GlyphSpec interop (portfolio format) ————————————————————————

export type SpecShape = [Kind, number, number, number, number]
export type SpecLine = [number, number, number, number]
export interface GlyphSpec {
  f?: SpecShape[]
  o?: SpecShape[]
  k?: SpecShape[]
  l?: SpecLine[]
}

const toTuple = (s: Shape): SpecShape => [s.kind, round(s.x), round(s.y), round(s.w), round(s.h)]

export function linkLine(doc: Doc, link: Link): SpecLine | null {
  const a = doc.shapes.find((s) => s.id === link.a)
  const b = doc.shapes.find((s) => s.id === link.b)
  if (!a || !b) return null
  const [x1, y1] = center(a)
  const [x2, y2] = center(b)
  return [round(x1), round(y1), round(x2), round(y2)]
}

export function toSpec(doc: Doc): GlyphSpec {
  const spec: GlyphSpec = {}
  const f = doc.shapes.filter((s) => s.role === "fill").map(toTuple)
  const o = doc.shapes.filter((s) => s.role === "outline").map(toTuple)
  const k = doc.shapes.filter((s) => s.role === "ink").map(toTuple)
  const l = doc.links.map((link) => linkLine(doc, link)).filter((x): x is SpecLine => !!x)
  if (f.length) spec.f = f
  if (o.length) spec.o = o
  if (k.length) spec.k = k
  if (l.length) spec.l = l
  return spec
}

/** Lines whose ends don't land on a shape centre are dropped. */
export function fromSpec(spec: GlyphSpec): Doc {
  const make = (role: Role) => (t: SpecShape) => ({ id: newId(), kind: t[0], role, x: t[1], y: t[2], w: t[3], h: t[4] })
  const shapes: Shape[] = [
    ...(spec.f ?? []).map(make("fill")),
    ...(spec.o ?? []).map(make("outline")),
    ...(spec.k ?? []).map(make("ink")),
  ]
  const nearest = (x: number, y: number) => {
    let best: Shape | undefined
    let bestD = 6
    for (const s of shapes) {
      const [cx, cy] = center(s)
      const d = Math.hypot(cx - x, cy - y)
      if (d < bestD) {
        best = s
        bestD = d
      }
    }
    return best
  }
  const links: Link[] = []
  for (const [x1, y1, x2, y2] of spec.l ?? []) {
    const a = nearest(x1, y1)
    const b = nearest(x2, y2)
    if (a && b && a !== b) links.push({ id: newId("l"), a: a.id, b: b.id })
  }
  return { shapes, links }
}

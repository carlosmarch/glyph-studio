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

interface Group {
  expr: string
  /** Shape that takes relations from the left, as in the formula parser. */
  head: string
  /** Topmost shape of a stack, where an anchor's line lands. */
  top: string
  /** The relation this group is a chain of, so `▲ / ■ / ■` stays flat. */
  chain?: RelationKind
  /** Needs brackets when it's an operand of a tight relation. */
  compound: boolean
}

// Inner relations first, so `▲ | (○ × ■)` groups the overlap before the anchor.
const BIND_ORDER: RelationKind[] = ["nest", "overlap", "stack", "anchor"]

/**
 * The glyph written in the grammar's notation, grouped the way the formula
 * field reads it: stack, nest, overlap and anchor bind tighter than connect,
 * so `▲ | (○ × ■) — ●` reads back as typed. Several shapes on one base become
 * a fan (`{▲, ▲} / ■`) or a connected group (`(● — ■) / ■`), one shape on
 * several bases a row (`▲ / (■ ■)`), and a ring of lines a loop
 * (`▲ — ● — ■ — ▲`). Whatever can't be written in one expression is listed
 * as a separate part.
 */
export function formula(doc: Doc): string {
  if (!doc.shapes.length) return ""
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  const relations = inferRelations(doc)
  const groupOf = new Map<string, Group>()
  const members = new Map<Group, string[]>()
  for (const s of doc.shapes) {
    const g: Group = { expr: symbol(s), head: s.id, top: s.id, compound: false }
    groupOf.set(s.id, g)
    members.set(g, [s.id])
  }
  const join = (parts: Group[], g: Group) => {
    const ids = parts.flatMap((p) => members.get(p)!)
    for (const p of parts) members.delete(p)
    members.set(g, ids)
    for (const id of ids) groupOf.set(id, g)
    return g
  }
  const atom = (id: string) => members.get(groupOf.get(id)!)!.length === 1
  const wrap = (g: Group) => (g.compound ? `(${g.expr})` : g.expr)
  const used = new Set<InferredRelation>()
  const connects = relations.filter((r) => r.kind === "connect")
  const extra: string[] = []
  const loose = (r: InferredRelation) =>
    extra.push(`${symbol(byId.get(r.a)!)} ${RELATION_META[r.kind].op} ${symbol(byId.get(r.b)!)}`)

  for (const kind of BIND_ORDER) {
    const op = RELATION_META[kind].op
    const ofKind = relations.filter((r) => r.kind === kind)

    // Several atoms on one base: `{▲, ▲} / ■`, or `(● — ■) / ■` when they're joined.
    for (const b of new Set(ofKind.map((r) => r.b))) {
      const rs = ofKind.filter((r) => r.b === b && !used.has(r))
      const as = rs.map((r) => r.a)
      if (as.length < 2 || !as.every(atom) || groupOf.get(b)!.head !== b) continue
      const path = connectPath(as, connects.filter((r) => !used.has(r)))
      const A: Group = path
        ? { expr: path.order.map((id) => symbol(byId.get(id)!)).join(" — "), head: path.order[0], top: path.order[0], compound: true }
        : { expr: `{${as.map((id) => symbol(byId.get(id)!)).join(", ")}}`, head: as[0], top: as[0], compound: false }
      path?.edges.forEach((r) => used.add(r))
      rs.forEach((r) => used.add(r))
      const B = groupOf.get(b)!
      join([...as.map((id) => groupOf.get(id)!), B], { expr: `${wrap(A)} ${op} ${wrap(B)}`, head: B.head, top: kind === "stack" ? A.top : B.top, chain: kind, compound: true })
    }

    // One shape across several atom bases: `▲ / (■ ■)`.
    for (const a of new Set(ofKind.map((r) => r.a))) {
      const rs = ofKind.filter((r) => r.a === a && !used.has(r))
      const bs = rs.map((r) => r.b)
      if (bs.length < 2 || !bs.every(atom) || groupOf.get(a)!.head !== a) continue
      rs.forEach((r) => used.add(r))
      const A = groupOf.get(a)!
      const row = `(${bs.map((id) => symbol(byId.get(id)!)).join(" ")})`
      join([A, ...bs.map((id) => groupOf.get(id)!)], { expr: `${wrap(A)} ${op} ${row}`, head: bs[0], top: kind === "stack" ? A.top : bs[0], compound: true })
    }

    for (const r of ofKind) {
      if (used.has(r)) continue
      used.add(r)
      const A = groupOf.get(r.a)!
      const B = groupOf.get(r.b)!
      // An anchor may also flag the top of a stack: `● | (■ / ■)`.
      const onB = B.head === r.b || (kind === "anchor" && B.chain === "stack" && B.top === r.b)
      if (A === B || A.head !== r.a || !onB) {
        loose(r)
        continue
      }
      // A same-relation chain reads flat for stack (`▲ / ■ / ■`); anything else is grouped.
      const left = A.chain === "stack" && kind === "stack" ? A.expr : wrap(A)
      join([A, B], { expr: `${left} ${op} ${wrap(B)}`, head: B.head, top: kind === "stack" ? A.top : B.top, chain: kind, compound: true })
    }
  }

  // Connect joins whole groups head to head, as a chain, a fan or a loop.
  const edges = new Map<Group, Group[]>()
  const closing = new Map<Group, Group>()
  const firstFrom: Group[] = []
  for (const r of connects) {
    if (used.has(r)) continue
    const A = groupOf.get(r.a)!
    const B = groupOf.get(r.b)!
    if (A === B || A.head !== r.a || B.head !== r.b) {
      loose(r)
    } else if (reachable(edges, A, B)) {
      if (closing.has(A) || closing.has(B)) loose(r)
      else closing.set(A, B).set(B, A)
    } else {
      edges.set(A, [...(edges.get(A) ?? []), B])
      edges.set(B, [...(edges.get(B) ?? []), A])
      firstFrom.push(A)
    }
  }

  const done = new Set<Group>()
  const write = (g: Group, from: Group | null): string => {
    done.add(g)
    const next = (edges.get(g) ?? []).filter((n) => n !== from)
    // Tight relations bind closer than connect; the brackets just make the parts easy to see.
    if (!next.length) return wrap(g)
    if (next.length === 1) return `${wrap(g)} — ${write(next[0], g)}`
    return `${wrap(g)} — {${next.map((n) => write(n, g)).join(", ")}}`
  }
  const degree = (g: Group) => edges.get(g)?.length ?? 0
  const parts: string[] = []
  for (const g of [...firstFrom, ...members.keys()]) {
    if (done.has(g)) continue
    const root = degree(g) === 2 ? walkToEnd(edges, g) : g
    if (!degree(root) && !closing.has(root)) {
      // A part on its own needs no outer brackets: `▲ | (○ × ■)`.
      done.add(root)
      parts.push(root.expr)
      continue
    }
    const end = closing.get(root)
    // A ring is a path whose two ends are joined; the parser closes it when the first shape repeats.
    if (end && members.get(root)!.length === 1 && isPath(edges, root, end)) {
      parts.push(`${write(root, null)} — ${root.expr}`)
      closing.delete(root)
      closing.delete(end)
    } else parts.push(write(root, null))
  }
  // Lines that close a ring we couldn't write as a loop. Each is stored both ways; list it once.
  for (const [a, b] of closing) {
    if (a.head < b.head) extra.push(`${symbol(byId.get(a.head)!)} — ${symbol(byId.get(b.head)!)}`)
  }
  return [...parts, ...extra].join("  ·  ")
}

/** The ids joined end to end by connect lines, if they form a single path. */
function connectPath(ids: string[], connects: InferredRelation[]): { order: string[]; edges: InferredRelation[] } | null {
  const set = new Set(ids)
  const edges = connects.filter((r) => set.has(r.a) && set.has(r.b))
  if (edges.length !== ids.length - 1) return null
  const nbrs = new Map(ids.map((id) => [id, [] as string[]]))
  for (const r of edges) {
    nbrs.get(r.a)!.push(r.b)
    nbrs.get(r.b)!.push(r.a)
  }
  if ([...nbrs.values()].some((n) => n.length > 2)) return null
  const start = ids.find((id) => nbrs.get(id)!.length === 1)
  if (!start) return null
  const order = [start]
  while (order.length < ids.length) {
    const next = nbrs.get(order[order.length - 1])!.find((n) => !order.includes(n))
    if (!next) return null
    order.push(next)
  }
  return { order, edges }
}

function reachable(edges: Map<Group, Group[]>, a: Group, b: Group): boolean {
  const seen = new Set<Group>([a])
  const queue = [a]
  while (queue.length) {
    const g = queue.shift()!
    if (g === b) return true
    for (const n of edges.get(g) ?? []) {
      if (seen.has(n)) continue
      seen.add(n)
      queue.push(n)
    }
  }
  return false
}

/** Whether the lines from `start` run as one unbranched path that ends at `end`. */
function isPath(edges: Map<Group, Group[]>, start: Group, end: Group): boolean {
  let prev: Group | null = null
  let cur = start
  for (;;) {
    const next = (edges.get(cur) ?? []).filter((n) => n !== prev)
    if (!next.length) return cur === end
    if (next.length > 1) return false
    prev = cur
    cur = next[0]
  }
}

/** Walk a path from its middle to one end. Hubs (3+ lines) stay as the root. */
function walkToEnd(edges: Map<Group, Group[]>, g: Group): Group {
  let prev: Group | null = null
  let cur = g
  for (;;) {
    const next = (edges.get(cur) ?? []).filter((n) => n !== prev)
    if (next.length !== 1 || (edges.get(cur)?.length ?? 0) > 2) return cur
    prev = cur
    cur = next[0]
  }
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
    // A linked outline is a hollow node (■ — ○ — ■: an empty, unwritten space), not a broken overlap.
    const onALine = doc.links.some((l) => l.a === s.id || l.b === s.id)
    if (s.role === "outline" && !onALine && !relations.some((r) => r.kind === "overlap" && r.a === s.id)) {
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

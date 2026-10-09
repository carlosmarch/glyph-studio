/**
 * Formula → glyph. Parses the grammar's notation and lays it out with the
 * proportions of the reference matrix.
 *
 *   ● ▲ ■           primitives (○ △ □ = drawn as an outline)
 *   A — B           connect      (also -)
 *   A / B           stack        (A rests on B)
 *   A ⊂ B           nest         (also <)   A drawn in ink inside B
 *   A × B           overlap      (also x)   A outlined across B
 *   A | B           anchor                 small A tethered above B
 *   ( … )           group a sub-glyph
 *   { A, B }        one to many
 *   A B             side by side, no relation
 *   ·               separate glyph parts
 *
 * ASCII aliases for typing: c/o = circle, t/^ = triangle, s/# = square.
 */
import { BOX_H, BOX_W, MAX_SHAPES, formula as readFormula, newId, validate, type Doc, type Kind, type Link, type RelationKind, type Role, type Shape } from "./grammar"

// —— Tokens ——————————————————————————————————————————————————

type Token =
  | { t: "shape"; kind: Kind; hollow: boolean; at: number }
  | { t: "op"; op: RelationKind; at: number }
  | { t: "("; at: number }
  | { t: ")"; at: number }
  | { t: "{"; at: number }
  | { t: "}"; at: number }
  | { t: ","; at: number }
  | { t: "·"; at: number }

const SHAPES: Record<string, { kind: Kind; hollow: boolean }> = {
  "●": { kind: "circle", hollow: false },
  "○": { kind: "circle", hollow: true },
  c: { kind: "circle", hollow: false },
  o: { kind: "circle", hollow: false },
  "▲": { kind: "triangle", hollow: false },
  "△": { kind: "triangle", hollow: true },
  t: { kind: "triangle", hollow: false },
  "^": { kind: "triangle", hollow: false },
  "■": { kind: "square", hollow: false },
  "□": { kind: "square", hollow: true },
  s: { kind: "square", hollow: false },
  "#": { kind: "square", hollow: false },
}

const OPS: Record<string, RelationKind> = {
  "—": "connect",
  "–": "connect",
  "-": "connect",
  "/": "stack",
  "⊂": "nest",
  "<": "nest",
  "×": "overlap",
  x: "overlap",
  "|": "anchor",
}

export class FormulaError extends Error {
  at: number
  constructor(message: string, at: number) {
    super(message)
    this.at = at
  }
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  const chars = Array.from(src)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (/\s/.test(ch)) continue
    const lower = ch.toLowerCase()
    if (SHAPES[ch] || SHAPES[lower]) {
      const s = SHAPES[ch] ?? SHAPES[lower]
      tokens.push({ t: "shape", ...s, at: i })
    } else if (OPS[ch] || OPS[lower]) {
      tokens.push({ t: "op", op: OPS[ch] ?? OPS[lower], at: i })
    } else if ("(){},".includes(ch)) {
      tokens.push({ t: ch as "(" | ")" | "{" | "}" | ",", at: i })
    } else if (ch === "·" || ch === "•" || ch === ";") {
      tokens.push({ t: "·", at: i })
    } else {
      throw new FormulaError(`“${ch}” isn't part of the grammar`, i)
    }
  }
  return tokens
}

// —— Tree ——————————————————————————————————————————————————————

type Node =
  | { type: "shape"; kind: Kind; hollow: boolean }
  | { type: "rel"; op: RelationKind; a: Node; b: Node }
  | { type: "row"; items: Node[] }
  | { type: "fan"; items: Node[] }

function parse(src: string): Node[] {
  const tokens = tokenize(src)
  let i = 0
  const peek = () => tokens[i]
  const end = src.length

  function term(): Node {
    const tok = peek()
    if (!tok) throw new FormulaError("Expected a shape", end)
    if (tok.t === "shape") {
      i++
      return { type: "shape", kind: tok.kind, hollow: tok.hollow }
    }
    if (tok.t === "(") {
      i++
      const inner = chain()
      if (peek()?.t !== ")") throw new FormulaError("Missing “)”", peek()?.at ?? end)
      i++
      return inner
    }
    if (tok.t === "{") {
      i++
      const items = [chain()]
      while (peek()?.t === ",") {
        i++
        items.push(chain())
      }
      if (peek()?.t !== "}") throw new FormulaError("Missing “}”", peek()?.at ?? end)
      i++
      return { type: "fan", items }
    }
    throw new FormulaError(tok.t === "op" ? "A relation needs a shape on its left" : `Unexpected “${tok.t}”`, tok.at)
  }

  /** Juxtaposed terms with no operator sit side by side: (■ ■ ■). */
  function row(): Node {
    const items = [term()]
    while (peek() && (peek().t === "shape" || peek().t === "(" || peek().t === "{")) items.push(term())
    return items.length === 1 ? items[0] : { type: "row", items }
  }

  const opAhead = () => {
    const tok = peek()
    return tok?.t === "op" ? tok.op : null
  }

  /** Stack, nest, overlap and anchor bind tighter than connect, right to left: ▲ | ● × ■ = ▲ | (● × ■). */
  function relation(): Node {
    const left = row()
    const op = opAhead()
    if (!op || op === "connect") return left
    i++
    if (!peek()) throw new FormulaError("A relation needs a shape on its right", end)
    return { type: "rel", op, a: left, b: relation() }
  }

  /** Connect binds loosest and chains left to right: ● — ▲ / ■ = ● — (▲ / ■). */
  function chain(): Node {
    let left = relation()
    while (opAhead() === "connect") {
      i++
      if (!peek()) throw new FormulaError("A relation needs a shape on its right", end)
      left = { type: "rel", op: "connect", a: left, b: relation() }
    }
    return left
  }

  const parts: Node[] = []
  if (!tokens.length) return parts
  parts.push(chain())
  while (peek()) {
    const tok = peek()
    if (tok.t === "·" || tok.t === ",") {
      i++
      if (peek()) parts.push(chain())
    } else {
      throw new FormulaError(`Unexpected “${tok.t === "op" ? "relation" : tok.t === "shape" ? "shape" : tok.t}”`, tok.at)
    }
  }
  return parts
}

// —— Layout ————————————————————————————————————————————————————

const BASE = 36

interface Placed {
  key: string
  kind: Kind
  role: Role
  x: number
  y: number
  w: number
  h: number
}

interface Block {
  shapes: Placed[]
  links: [string, string][]
  /** Shape that receives relations from the left (the block's main body). */
  head: string
  /** Shape that sends a connect to the right. */
  tail: string
  /** Every head of a fan, for one-to-many links. */
  heads: string[]
}

let keySeq = 0
const nextKey = () => `k${keySeq++}`

/**
 * Random layouts: when set, every proportion below is drawn from a range
 * instead of the reference matrix's fixed value, so sizes, angles and
 * spacing vary while each relation still reads the same.
 */
let jitter: (() => number) | null = null
/** `def` normally; somewhere in [lo, hi] for a random layout. */
const vary = (def: number, lo: number, hi: number) => (jitter ? lo + jitter() * (hi - lo) : def)
const chance = (p: number) => !!jitter && jitter() < p

function bbox(shapes: Placed[]) {
  const minX = Math.min(...shapes.map((s) => s.x))
  const minY = Math.min(...shapes.map((s) => s.y))
  const maxX = Math.max(...shapes.map((s) => s.x + s.w))
  const maxY = Math.max(...shapes.map((s) => s.y + s.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

function translate(b: Block, dx: number, dy: number): Block {
  return { ...b, shapes: b.shapes.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy })) }
}

function scale(b: Block, k: number): Block {
  const box = bbox(b.shapes)
  return {
    ...b,
    shapes: b.shapes.map((s) => ({
      ...s,
      x: box.x + (s.x - box.x) * k,
      y: box.y + (s.y - box.y) * k,
      w: s.w * k,
      h: s.h * k,
    })),
  }
}

/** Put block `b` so its bbox is at (x, y). */
function moveTo(b: Block, x: number, y: number): Block {
  const box = bbox(b.shapes)
  return translate(b, x - box.x, y - box.y)
}

function merge(a: Block, b: Block, extra: [string, string][], head: string, tail: string, heads?: string[]): Block {
  return { shapes: [...a.shapes, ...b.shapes], links: [...a.links, ...b.links, ...extra], head, tail, heads: heads ?? [head] }
}

const find = (b: Block, key: string) => b.shapes.find((s) => s.key === key)!

function shapeBlock(kind: Kind, hollow: boolean): Block {
  const key = nextKey()
  const w = BASE * vary(1, 0.45, 1.7)
  // Squares and triangles sometimes stretch; circles stay round.
  const aspect = kind !== "circle" && chance(0.35) ? vary(1, 0.6, 1.6) : 1
  const h = (kind === "triangle" ? w * 0.92 : w) * aspect
  return {
    shapes: [{ key, kind, role: hollow ? "outline" : "fill", x: 0, y: 0, w, h }],
    links: [],
    head: key,
    tail: key,
    heads: [key],
  }
}

/** `row`: a fan sits side by side (when it's on the left of anchor or stack); `column` otherwise. */
function layout(node: Node, fanDirection: "row" | "column" = "column"): Block {
  if (node.type === "shape") return shapeBlock(node.kind, node.hollow)

  if (node.type === "row") {
    let acc = layout(node.items[0])
    for (const item of node.items.slice(1)) {
      const next = layout(item)
      const a = bbox(acc.shapes)
      const n = bbox(next.shapes)
      const placed = moveTo(next, a.x + a.w + vary(4, 4, 16), a.y + a.h - n.h)
      acc = merge(acc, placed, [], acc.head, placed.tail, [...acc.heads, ...placed.heads])
    }
    return acc
  }

  if (node.type === "fan") {
    // One to many: every member's head takes the relation.
    let acc = layout(node.items[0])
    for (const item of node.items.slice(1)) {
      const next = layout(item)
      const a = bbox(acc.shapes)
      const n = bbox(next.shapes)
      // Column members sit far enough apart that they never read as stacked.
      const placed =
        fanDirection === "row"
          ? moveTo(next, a.x + a.w + vary(10, 8, 24), a.y + a.h - n.h)
          : moveTo(next, a.cx - n.w / 2 + vary(0, -1, 1) * a.w * 0.6, a.y + a.h + vary(22, 18, 40))
      acc = merge(acc, placed, [], acc.head, placed.tail, [...acc.heads, ...placed.heads])
    }
    return acc
  }

  const { op } = node

  if (op === "connect") {
    const A = layout(node.a)
    const B = layout(node.b)
    const a = bbox(A.shapes)
    const b = bbox(B.shapes)
    // Random layouts swing the line: long or short, rising, falling or dropping straight down.
    const gap = vary(26, 16, 80)
    const placed = chance(0.18)
      ? moveTo(B, a.cx - b.w / 2 + vary(0, -1, 1) * a.w, a.y + a.h + gap * 0.7)
      : moveTo(B, a.x + a.w + gap, a.cy - b.h / 2 + vary(0, -1, 1) * Math.max(a.h, b.h) * 0.9)
    const links: [string, string][] = placed.heads.map((h) => [A.tail, h])
    return merge(A, placed, links, A.head, placed.tail)
  }

  if (op === "stack") {
    let A = layout(node.a, "row")
    const B = layout(node.b)
    const a0 = bbox(A.shapes)
    const b = bbox(B.shapes)
    const fit = vary(0.9, 0.35, 0.95)
    if (a0.w > b.w * fit || chance(0.5)) A = scale(A, (b.w * fit) / a0.w)
    const a = bbox(A.shapes)
    // Off-centre on its base, but always with enough footing to read as stacked.
    const slide = vary(0, -1, 1) * Math.max(0, (b.w - a.w) / 2)
    const placed = moveTo(A, b.cx - a.w / 2 + slide, b.y - a.h - 3)
    return merge(placed, B, [], B.head, B.tail, B.heads)
  }

  if (op === "anchor") {
    // A is a small flag above B's head, each of A's heads tethered to it (a fan anchors many).
    let A = layout(node.a, "row")
    const B = layout(node.b)
    const target = find(B, B.head)
    const a0 = bbox(A.shapes)
    const fan = A.heads.length > 1
    const k = fan ? Math.min(1, (target.w * 2.4) / a0.w, 0.5) : Math.min(0.5, (target.w * vary(0.6, 0.3, 0.62)) / a0.w)
    A = scale(A, k)
    const a = bbox(A.shapes)
    const sway = vary(0, -1, 1) * target.w * 0.7
    const placed = moveTo(A, target.x + target.w / 2 - a.w / 2 + sway, target.y - a.h - vary(22, 12, 44))
    const links: [string, string][] = placed.heads.map((h) => [h, B.head])
    return merge(placed, B, links, B.head, B.tail, B.heads)
  }

  if (op === "overlap") {
    // A drawn as an outline across B's head, same size, shifted half a width left.
    let A = layout(node.a)
    const B = layout(node.b)
    const target = find(B, B.head)
    const a0 = bbox(A.shapes)
    A = scale(A, Math.max(target.w / a0.w, target.h / a0.h) * (A.shapes.length === 1 ? 1 : 0.8) * vary(1, 0.6, 1.35))
    A = { ...A, shapes: A.shapes.map((s) => ({ ...s, role: s.role === "ink" ? "ink" : "outline" })) }
    const a = bbox(A.shapes)
    // Shifted half a width left; a random layout crosses from any side, by any amount.
    const angle = jitter ? jitter() * Math.PI * 2 : Math.PI
    const shift = vary(0.5, 0.25, 0.65)
    const dx = Math.cos(angle) * target.w * shift
    const dy = jitter ? Math.sin(angle) * target.h * shift : 0
    const placed = moveTo(A, target.x + target.w / 2 - a.w / 2 + dx + (jitter ? 0 : (a.w - target.w) / 2), target.y + target.h / 2 - a.h / 2 + dy)
    return merge(placed, B, [], B.head, B.tail, B.heads)
  }

  // nest: A drawn in ink inside B's head, which grows to hold it.
  let A = layout(node.a)
  let B = layout(node.b)
  const host = find(B, B.head)
  const grow = Math.max(1, 64 / host.w)
  if (grow > 1) B = scale(B, grow)
  const target = find(B, B.head)
  const triangle = target.kind === "triangle"
  const fill = triangle ? vary(0.34, 0.2, 0.36) : vary(0.5, 0.22, 0.66)
  const room = { w: target.w * fill, h: target.h * fill }
  const a0 = bbox(A.shapes)
  A = scale(A, Math.min(room.w / a0.w, room.h / a0.h, 1))
  A = { ...A, shapes: A.shapes.map((s) => ({ ...s, role: "ink" })) }
  const a = bbox(A.shapes)
  // In a square or circle the mark can drift from the centre while staying well inside.
  const drift = triangle ? 0 : (1 - fill) * (target.kind === "circle" ? 0.22 : 0.38)
  const cx = target.x + target.w / 2 + vary(0, -1, 1) * target.w * drift
  const cy = (triangle ? target.y + target.h * 0.68 : target.y + target.h / 2) + vary(0, -1, 1) * target.h * drift
  const placed = moveTo(A, cx - a.w / 2, cy - a.h / 2)
  return merge(B, placed, [], B.head, B.tail, B.heads)
}

/** A three-term connect that ends where it started closes into a loop: ● — ▲ — ■ — ●. */
function loopOf(node: Node): Node[] | null {
  const terms: Node[] = []
  let n: Node = node
  while (n.type === "rel" && n.op === "connect") {
    terms.unshift(n.b)
    n = n.a
  }
  terms.unshift(n)
  if (terms.length < 4) return null
  const first = terms[0]
  const last = terms[terms.length - 1]
  if (first.type !== "shape" || last.type !== "shape" || first.kind !== last.kind) return null
  return terms.slice(0, -1)
}

function layoutLoop(terms: Node[]): Block {
  const blocks = terms.map((t) => layout(t))
  const n = blocks.length
  // Place on a circle (a triangle for three), first at the bottom-left.
  const radius = (34 + n * 4) * vary(1, 0.9, 1.6)
  const start = vary(Math.PI * 0.75, 0, Math.PI * 2)
  const squash = vary(0.8, 0.45, 1)
  const placed = blocks.map((b, i) => {
    const angle = start + (i * 2 * Math.PI) / n + vary(0, -0.3, 0.3)
    const box = bbox(b.shapes)
    return moveTo(b, Math.cos(angle) * radius - box.w / 2, -Math.sin(angle) * radius * squash - box.h / 2)
  })
  let acc = placed[0]
  for (let i = 1; i < n; i++) acc = merge(acc, placed[i], [[placed[i - 1].tail, placed[i].head]], acc.head, placed[i].tail)
  return { ...acc, links: [...acc.links, [placed[n - 1].tail, placed[0].head]] }
}

const PAD = 10
const MAX_SCALE = 1.35

/**
 * Parse a formula and lay it out in the 200 × 100 box. Throws FormulaError.
 * With `rand`, sizes, spacing, angles and the glyph's place in the box vary.
 */
export function formulaToDoc(src: string, rand?: () => number): Doc {
  keySeq = 0
  const parts = parse(src)
  if (!parts.length) return { shapes: [], links: [] }
  jitter = rand ?? null
  try {
    return layoutDoc(parts)
  } finally {
    jitter = null
  }
}

function layoutDoc(parts: Node[]): Doc {
  let acc: Block | null = null
  for (const part of parts) {
    const loop = loopOf(part)
    const block = loop ? layoutLoop(loop) : layout(part)
    if (!acc) {
      acc = block
      continue
    }
    const a = bbox(acc.shapes)
    const k = vary(1, 0.5, 1.5)
    const sized = k === 1 ? block : scale(block, k)
    const s = bbox(sized.shapes)
    const dy = vary(0, -1, 1) * Math.max(a.h, s.h) * 0.6
    acc = merge(acc, moveTo(sized, a.x + a.w + vary(30, 18, 60), a.cy - s.h / 2 + dy), [], acc.head, sized.tail)
  }

  // Fit the whole thing into the box: centred, or for a random layout at any
  // size and pushed towards any edge.
  const box = bbox(acc!.shapes)
  const pad = jitter ? 4 : PAD
  const fit = Math.min((BOX_W - pad * 2) / box.w, (BOX_H - pad * 2) / box.h)
  const k = jitter ? Math.min(fit, 2.4) * vary(1, 0.55, 1) : Math.min(fit, MAX_SCALE)
  const fitted = scale(acc!, k)
  const fb = bbox(fitted.shapes)
  const align = () => (chance(0.4) ? 0.5 : jitter ? pick([0, 0.25, 0.75, 1], jitter) : 0.5)
  const x = pad + (BOX_W - pad * 2 - fb.w) * align()
  const y = pad + (BOX_H - pad * 2 - fb.h) * align()
  const final = translate(fitted, x - fb.x, y - fb.y)

  const ids = new Map(final.shapes.map((s) => [s.key, newId()]))
  const r = (v: number) => Math.round(v * 10) / 10
  const shapes: Shape[] = final.shapes.map((s) => ({
    id: ids.get(s.key)!,
    kind: s.kind,
    role: s.role,
    x: r(s.x),
    y: r(s.y),
    w: r(s.w),
    h: r(s.h),
  }))
  const seen = new Set<string>()
  const links: Link[] = []
  for (const [a, b] of final.links) {
    const id = [a, b].sort().join("-")
    if (a === b || seen.has(id)) continue
    seen.add(id)
    links.push({ id: newId("l"), a: ids.get(a)!, b: ids.get(b)! })
  }
  return { shapes, links }
}

/** Parse without laying out — for validating as the user types. */
export function checkFormula(src: string): FormulaError | null {
  try {
    parse(src)
    return null
  } catch (e) {
    return e instanceof FormulaError ? e : new FormulaError(String(e), 0)
  }
}

/** Symbols for the input's insert bar. */
export const FORMULA_KEYS: { key: string; label: string }[] = [
  { key: "●", label: "Circle" },
  { key: "▲", label: "Triangle" },
  { key: "■", label: "Square" },
  { key: "○", label: "Outlined circle" },
  { key: "△", label: "Outlined triangle" },
  { key: "□", label: "Outlined square" },
  { key: " — ", label: "Connect" },
  { key: " / ", label: "Stack" },
  { key: " ⊂ ", label: "Nest" },
  { key: " × ", label: "Overlap" },
  { key: " | ", label: "Anchor" },
  { key: "(", label: "Open group" },
  { key: ")", label: "Close group" },
  { key: "{", label: "Open one-to-many" },
  { key: "}", label: "Close one-to-many" },
  { key: ", ", label: "Separator" },
]

// —— Random glyphs ——————————————————————————————————————————————

const pick = <T,>(xs: readonly T[], rand: () => number) => xs[Math.floor(rand() * xs.length)]
const SYMBOLS = ["●", "▲", "■"] as const
const HOLLOW = ["○", "△", "□"] as const
const OP_SYMBOLS = [" — ", " — ", " / ", " ⊂ ", " × ", " | "] as const

/** A random 2–5 shape formula: relations, groups, fans, loops and separate parts. */
export function randomFormula(rand = Math.random): string {
  const shape = (hollowOk = false) => (hollowOk && rand() < 0.2 ? pick(HOLLOW, rand) : pick(SYMBOLS, rand))
  const wrap = (e: { expr: string; n: number }) => (e.n > 1 ? `(${e.expr})` : e.expr)

  function expr(n: number, top: boolean, onLine = false): { expr: string; n: number } {
    if (n === 1) return { expr: shape(onLine), n }
    const r = rand()
    // A loop: ● — ▲ — ■ — ●
    if (top && n >= 3 && n <= 4 && r < 0.12) {
      const first = shape()
      const middle = Array.from({ length: n - 1 }, () => shape(true))
      return { expr: [first, ...middle, first].join(" — "), n }
    }
    // One to many: {▲, ●} / ■ or ■ — {●, ●, ●}
    if (n >= 3 && r < 0.3) {
      const k = 2 + Math.floor(rand() * Math.min(2, n - 2))
      const fan = `{${Array.from({ length: k }, () => shape()).join(", ")}}`
      const rest = expr(n - k, false)
      const op = pick([" — ", " / ", " | "] as const, rand)
      return { expr: op === " — " ? `${wrap(rest)} — ${fan}` : `${fan}${op}${wrap(rest)}`, n }
    }
    // Two separate parts.
    if (top && n >= 3 && r < 0.42) {
      const k = 1 + Math.floor(rand() * (n - 1))
      return { expr: `${expr(k, false).expr} · ${expr(n - k, false).expr}`, n }
    }
    const k = 1 + Math.floor(rand() * (n - 1))
    const op = pick(OP_SYMBOLS, rand)
    const line = op === " — "
    return { expr: `${wrap(expr(k, false, line))}${op}${wrap(expr(n - k, false, line))}`, n }
  }

  const n = pick([2, 3, 3, 4, 4, 5, 5], rand)
  return expr(n, true).expr
}

const intersects = (a: Shape, b: Shape, margin = 0) =>
  a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin
const inside = (outer: Shape, inner: Shape) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** Does segment p→q cross rectangle r? (Liang–Barsky clip.) */
function crosses(p: [number, number], q: [number, number], r: Shape) {
  let t0 = 0
  let t1 = 1
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const edges: [number, number][] = [
    [-dx, p[0] - r.x],
    [dx, r.x + r.w - p[0]],
    [-dy, p[1] - r.y],
    [dy, r.y + r.h - p[1]],
  ]
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false
      continue
    }
    const t = qq / pp
    if (pp < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

/** A free layout is only kept when nothing collides that the grammar didn't ask to. */
function clean(doc: Doc): boolean {
  const { shapes } = doc
  if (shapes.some((s) => s.w < 7 || s.h < 7)) return false
  const onLine = new Set(doc.links.flatMap((l) => [l.a, l.b]))
  // Only an overlap's outline (never a hollow node on a line) may cross a body.
  const crossing = (s: Shape) => s.role === "outline" && !onLine.has(s.id)
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i]
      const b = shapes[j]
      const meant =
        a.role === "ink" || b.role === "ink"
          ? inside(a, b) || inside(b, a)
          : (crossing(a) && b.role === "fill") || (crossing(b) && a.role === "fill")
      if (!meant && intersects(a, b)) return false
    }
  }
  const byId = new Map(shapes.map((s) => [s.id, s]))
  const mid = (s: Shape): [number, number] => [s.x + s.w / 2, s.y + s.h * (s.kind === "triangle" ? 0.64 : 0.5)]
  for (const l of doc.links) {
    const a = byId.get(l.a)!
    const b = byId.get(l.b)!
    for (const s of shapes) {
      if (s === a || s === b || intersects(s, a) || intersects(s, b)) continue
      if (crosses(mid(a), mid(b), s)) return false
    }
  }
  return true
}

/**
 * A random glyph that passes the grammar's rules, with a free composition:
 * sizes, angles, spacing and placement in the box all vary, and the layout is
 * kept only if it still reads back as the formula it was built from.
 */
export function randomDoc(rand = Math.random): { doc: Doc; formula: string } {
  let last = { doc: { shapes: [], links: [] } as Doc, formula: "" }
  const ok = (doc: Doc) => doc.shapes.length && doc.shapes.length <= MAX_SHAPES && !validate(doc).length
  for (let i = 0; i < 40; i++) {
    const formula = randomFormula(rand)
    const plain = formulaToDoc(formula)
    if (!ok(plain)) continue
    last = { doc: plain, formula }
    const reads = readFormula(plain)
    for (let j = 0; j < 12; j++) {
      const doc = formulaToDoc(formula, rand)
      if (ok(doc) && clean(doc) && readFormula(doc) === reads) return { doc, formula }
    }
  }
  return last
}

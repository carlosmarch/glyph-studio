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
import { BOX_H, BOX_W, MAX_SHAPES, newId, validate, type Doc, type Kind, type Link, type RelationKind, type Role, type Shape } from "./grammar"

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
  return {
    shapes: [{ key, kind, role: hollow ? "outline" : "fill", x: 0, y: 0, w: BASE, h: kind === "triangle" ? BASE * 0.92 : BASE }],
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
      const placed = moveTo(next, a.x + a.w + 4, a.y + a.h - n.h)
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
          ? moveTo(next, a.x + a.w + 10, a.y + a.h - n.h)
          : moveTo(next, a.cx - n.w / 2, a.y + a.h + 22)
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
    const placed = moveTo(B, a.x + a.w + 26, a.cy - b.h / 2)
    const links: [string, string][] = placed.heads.map((h) => [A.tail, h])
    return merge(A, placed, links, A.head, placed.tail)
  }

  if (op === "stack") {
    let A = layout(node.a, "row")
    const B = layout(node.b)
    const a0 = bbox(A.shapes)
    const b = bbox(B.shapes)
    if (a0.w > b.w * 0.9) A = scale(A, (b.w * 0.9) / a0.w)
    const a = bbox(A.shapes)
    const placed = moveTo(A, b.cx - a.w / 2, b.y - a.h - 3)
    return merge(placed, B, [], B.head, B.tail, B.heads)
  }

  if (op === "anchor") {
    // A is a small flag above B's head, each of A's heads tethered to it (a fan anchors many).
    let A = layout(node.a, "row")
    const B = layout(node.b)
    const target = find(B, B.head)
    const a0 = bbox(A.shapes)
    const fan = A.heads.length > 1
    const k = fan ? Math.min(1, (target.w * 2.4) / a0.w, 0.5) : Math.min(0.5, (target.w * 0.6) / a0.w)
    A = scale(A, k)
    const a = bbox(A.shapes)
    const placed = moveTo(A, target.x + target.w / 2 - a.w / 2, target.y - a.h - 22)
    const links: [string, string][] = placed.heads.map((h) => [h, B.head])
    return merge(placed, B, links, B.head, B.tail, B.heads)
  }

  if (op === "overlap") {
    // A drawn as an outline across B's head, same size, shifted half a width left.
    let A = layout(node.a)
    const B = layout(node.b)
    const target = find(B, B.head)
    const a0 = bbox(A.shapes)
    A = scale(A, Math.max(target.w / a0.w, target.h / a0.h) * (A.shapes.length === 1 ? 1 : 0.8))
    A = { ...A, shapes: A.shapes.map((s) => ({ ...s, role: s.role === "ink" ? "ink" : "outline" })) }
    const a = bbox(A.shapes)
    const placed = moveTo(A, target.x - target.w * 0.5, target.y + target.h / 2 - a.h / 2)
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
  const room = { w: target.w * (triangle ? 0.34 : 0.5), h: target.h * (triangle ? 0.34 : 0.5) }
  const a0 = bbox(A.shapes)
  A = scale(A, Math.min(room.w / a0.w, room.h / a0.h, 1))
  A = { ...A, shapes: A.shapes.map((s) => ({ ...s, role: "ink" })) }
  const a = bbox(A.shapes)
  const cy = triangle ? target.y + target.h * 0.68 : target.y + target.h / 2
  const placed = moveTo(A, target.x + target.w / 2 - a.w / 2, cy - a.h / 2)
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
  const radius = 34 + n * 4
  const placed = blocks.map((b, i) => {
    const angle = Math.PI * 0.75 + (i * 2 * Math.PI) / n
    const box = bbox(b.shapes)
    return moveTo(b, Math.cos(angle) * radius - box.w / 2, -Math.sin(angle) * radius * 0.8 - box.h / 2)
  })
  let acc = placed[0]
  for (let i = 1; i < n; i++) acc = merge(acc, placed[i], [[placed[i - 1].tail, placed[i].head]], acc.head, placed[i].tail)
  return { ...acc, links: [...acc.links, [placed[n - 1].tail, placed[0].head]] }
}

const PAD = 10
const MAX_SCALE = 1.35

/** Parse a formula and lay it out in the 200 × 100 box. Throws FormulaError. */
export function formulaToDoc(src: string): Doc {
  keySeq = 0
  const parts = parse(src)
  if (!parts.length) return { shapes: [], links: [] }

  let acc: Block | null = null
  for (const part of parts) {
    const loop = loopOf(part)
    const block = loop ? layoutLoop(loop) : layout(part)
    if (!acc) {
      acc = block
      continue
    }
    const a = bbox(acc.shapes)
    const b = bbox(block.shapes)
    acc = merge(acc, moveTo(block, a.x + a.w + 30, a.cy - b.h / 2), [], acc.head, block.tail)
  }

  // Fit the whole thing into the box, centred.
  const box = bbox(acc!.shapes)
  const k = Math.min((BOX_W - PAD * 2) / box.w, (BOX_H - PAD * 2) / box.h, MAX_SCALE)
  const fitted = translate(scale(acc!, k), 0, 0)
  const fb = bbox(fitted.shapes)
  const final = translate(fitted, BOX_W / 2 - fb.cx, BOX_H / 2 - fb.cy)

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
const OP_SYMBOLS = [" — ", " / ", " ⊂ ", " × ", " | "] as const

/** A random 2–3 shape formula, e.g. `(▲ ⊂ ■) — ●`. */
export function randomFormula(rand = Math.random): string {
  const shape = () => pick(SYMBOLS, rand)
  const op = () => pick(OP_SYMBOLS, rand)
  if (rand() < 0.4) return `${shape()}${op()}${shape()}`
  return rand() < 0.5 ? `(${shape()}${op()}${shape()})${op()}${shape()}` : `${shape()}${op()}(${shape()}${op()}${shape()})`
}

/** A random glyph that passes the grammar's rules (falls back to the last try). */
export function randomDoc(rand = Math.random): { doc: Doc; formula: string } {
  let last = { doc: { shapes: [], links: [] } as Doc, formula: "" }
  for (let i = 0; i < 20; i++) {
    const formula = randomFormula(rand)
    const doc = formulaToDoc(formula)
    last = { doc, formula }
    if (doc.shapes.length && doc.shapes.length <= MAX_SHAPES && !validate(doc).length) return last
  }
  return last
}

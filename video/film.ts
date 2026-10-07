/**
 * Glyph System Studio — 30 s launch film.
 *
 * Every frame is a pure function of time: `window.seek(t)` draws the frame at
 * `t` seconds into #stage. `render.mjs` steps it in headless Chromium and pipes
 * the frames to ffmpeg. Open /video/index.html in `npm run dev` to scrub it
 * (←/→ step, space plays).
 */
import { formulaToDoc } from "@/lib/formula"
import { center, fromSpec, type Doc, type GlyphSpec, type Kind, type Role } from "@/lib/grammar"
import { COMPOUNDS, PALETTES, PRIMITIVES, pairSpec } from "@/lib/presets"

/** `?format=vertical` renders the 9:16 cut; every layout number below comes from here. */
const VERTICAL = new URLSearchParams(location.search).get("format") === "vertical"
export const W = VERTICAL ? 1080 : 1920
export const H = VERTICAL ? 1920 : 1080
const CX = W / 2
const NO_CAPTIONS = new URLSearchParams(location.search).has("nocaptions")
const L = VERTICAL
  ? {
      main: { s: 4.8, sx: 540, sy: 820 },
      ui: { s: 4.2, sx: 540, sy: 800 },
      toolbar: { cx: 540, cy: 1150, w: 300, h: 84, buttons: [450, 540, 630] },
      relate: { x: 354, y: 1050, w: 372, h: 330, from: [0, 900] as const },
      pill: { cx: 540, cy: 420, w: 720, h: 84 },
      capY: 1470,
      formY: 1370,
      capSize: 58,
      formSize: 50,
      wall: { scale: 1.05, sy: 960, cols: 3, rows: 8 },
    }
  : {
      main: { s: 7, sx: 960, sy: 470 },
      ui: { s: 5, sx: 960, sy: 500 },
      toolbar: { cx: 960, cy: 905, w: 300, h: 84, buttons: [870, 960, 1050] },
      relate: { x: 1468, y: 300, w: 372, h: 330, from: [480, 0] as const },
      pill: { cx: 960, cy: 128, w: 720, h: 84 },
      capY: 1000,
      formY: 905,
      capSize: 46,
      formSize: 44,
      wall: { scale: 0.86, sy: 540, cols: 6, rows: 5 },
    }
export const DURATION = 30

// —— Studio palette ——————————————————————————————————————————————

const PASTELS = PALETTES.slice(1, 8).map((p) => p.ground) // Yellow, Green, Blue, Pink, Purple, Orange, Teal
const YELLOW = PASTELS[0]
const FILL = "#FFFFFF"
const INK = "#020617"
const WORKSPACE = "#F2F2F2"
const BORDER = "#E5E5E5"
const MUTED = "#737373"
const SELECTION = "#3B82F6"
const STROKE = 1.8
const WOBBLE = 3
const SANS = "Inter, system-ui, sans-serif"
const MONO = "'DejaVu Sans Mono', ui-monospace, monospace"

// —— Maths ————————————————————————————————————————————————————————

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3
const r1 = (n: number) => Math.round(n * 10) / 10

/** Damped spring from 0 to 1, a touch livelier than the canvas spring so it reads on video. */
function spring(t: number, k = 300, c = 20, m = 0.8) {
  if (t <= 0) return 0
  const w0 = Math.sqrt(k / m)
  const z = c / (2 * Math.sqrt(k * m))
  if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  const wd = w0 * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number) {
  const [r, g, bl] = hex(a)
  const [r2, g2, b2] = hex(b)
  const q = clamp(t)
  return `rgb(${Math.round(lerp(r, r2, q))},${Math.round(lerp(g, g2, q))},${Math.round(lerp(bl, b2, q))})`
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// —— Glyph model for morphing ————————————————————————————————————

interface Item {
  kind: Kind
  role: Role
  x: number
  y: number
  w: number
  h: number
  pts?: number[] // polygon override when an item is caught mid-morph
}
interface G {
  items: Item[]
  links: [number, number][]
}
const EMPTY: G = { items: [], links: [] }

function fromDoc(doc: Doc): G {
  const idx = new Map(doc.shapes.map((s, i) => [s.id, i]))
  return {
    items: doc.shapes.map(({ kind, role, x, y, w, h }) => ({ kind, role, x, y, w, h })),
    links: doc.links.map((l) => [idx.get(l.a)!, idx.get(l.b)!] as [number, number]),
  }
}
const spec = (s: GlyphSpec) => fromDoc(fromSpec(s))
const formulaG = (f: string) => fromDoc(formulaToDoc(f))
const compound = (name: string) => {
  const p = COMPOUNDS.find((c) => c.name === name)
  if (!p) throw new Error(`No compound ${name}`)
  return p
}

/** Every outline is resampled to N points from its top-centre, clockwise, so any two shapes morph point to point. */
const N = 96
function poly(it: Item): number[] {
  if (it.pts) return it.pts
  const { kind, x, y, w, h } = it
  const out: number[] = new Array(N * 2)
  if (kind === "circle") {
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / N
      out[i * 2] = x + w / 2 + (w / 2) * Math.cos(a)
      out[i * 2 + 1] = y + h / 2 + (h / 2) * Math.sin(a)
    }
    return out
  }
  const v: [number, number][] =
    kind === "square"
      ? [[x + w / 2, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
      : [[x + w / 2, y], [x + w, y + h], [x, y + h]]
  const n = v.length
  const L = [0]
  for (let i = 0; i < n; i++) {
    const [ax, ay] = v[i]
    const [bx, by] = v[(i + 1) % n]
    L.push(L[i] + Math.hypot(bx - ax, by - ay))
  }
  const P = L[n]
  let seg = 0
  for (let i = 0; i < N; i++) {
    const s = (P * i) / N
    while (seg < n - 1 && L[seg + 1] <= s) seg++
    const [ax, ay] = v[seg]
    const [bx, by] = v[(seg + 1) % n]
    const len = L[seg + 1] - L[seg]
    const q = len > 0 ? (s - L[seg]) / len : 0
    out[i * 2] = lerp(ax, bx, q)
    out[i * 2 + 1] = lerp(ay, by, q)
  }
  // Pin the corners so squares and triangles stay sharp.
  if (P > 0) {
    for (let j = 0; j < n; j++) {
      const i = Math.round((L[j] / P) * N) % N
      out[i * 2] = v[j][0]
      out[i * 2 + 1] = v[j][1]
    }
  }
  return out
}

const centre = (it: Item): [number, number] => center(it)

interface Slot {
  a: Item
  b: Item
  born: boolean
  dies: boolean
  pa: number[]
  pb: number[]
}
interface Tween {
  slots: Slot[]
  linksB: { s: [number, number]; fresh: boolean }[]
  linksA: [number, number][] // links that go away
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  return out
}
const PERMS = [0, 1, 2, 3, 4, 5, 6].map(permutations)

function nearestCentre(list: Item[], p: [number, number]): [number, number] {
  let best = p
  let bd = Infinity
  for (const it of list) {
    const c = centre(it)
    const d = Math.hypot(c[0] - p[0], c[1] - p[1])
    if (d < bd) {
      bd = d
      best = c
    }
  }
  return best
}

/** Match A's shapes to B's (cheapest assignment), then morph matched pairs, grow new ones out of their nearest neighbour and fold leaving ones into theirs. */
function tween(A: G, B: G, origin?: [number, number]): Tween {
  const n = Math.max(A.items.length, B.items.length)
  const cost = (a?: Item, b?: Item) => {
    if (a && b) {
      const [ax, ay] = centre(a)
      const [bx, by] = centre(b)
      return Math.hypot(ax - bx, ay - by) / 10 + (a.kind !== b.kind ? 3 : 0) + (a.role !== b.role ? 2 : 0)
    }
    return a || b ? 9 : 0
  }
  let best: number[] = []
  let bestCost = Infinity
  for (const p of PERMS[n]) {
    let c = 0
    for (let j = 0; j < n; j++) c += cost(A.items[p[j]], B.items[j])
    if (c < bestCost) {
      bestCost = c
      best = p
    }
  }
  const slots: Slot[] = []
  const slotOfA = new Map<number, number>()
  const slotOfB = new Map<number, number>()
  for (let j = 0; j < n; j++) {
    const i = best[j]
    const a = A.items[i]
    const b = B.items[j]
    if (!a && !b) continue
    let from: Item
    let to: Item
    if (a && b) {
      from = a
      to = b
    } else if (b) {
      const [ox, oy] = origin ?? (A.items.length ? nearestCentre(A.items, centre(b)) : centre(b))
      from = { ...b, x: ox, y: oy, w: 0, h: 0, pts: undefined }
      to = b
    } else {
      const [tx, ty] = B.items.length ? nearestCentre(B.items, centre(a!)) : centre(a!)
      from = a!
      to = { ...a!, x: tx, y: ty, w: 0, h: 0, pts: undefined }
    }
    if (a) slotOfA.set(i, slots.length)
    if (b) slotOfB.set(j, slots.length)
    slots.push({ a: from, b: to, born: !a, dies: !b, pa: poly(from), pb: poly(to) })
  }
  const key = (s: [number, number]) => [...s].sort().join("-")
  const aKeys = new Set(A.links.map(([x, y]) => key([slotOfA.get(x)!, slotOfA.get(y)!])))
  const bKeys = new Set<string>()
  const linksB = B.links.map(([x, y]) => {
    const s: [number, number] = [slotOfB.get(x)!, slotOfB.get(y)!]
    bKeys.add(key(s))
    return { s, fresh: !aKeys.has(key(s)) }
  })
  const linksA = A.links
    .map(([x, y]) => [slotOfA.get(x)!, slotOfA.get(y)!] as [number, number])
    .filter((s) => !bKeys.has(key(s)))
  return { slots, linksB, linksA }
}

const STAGGER = 0.04
const slotP = (i: number, lt: number) => spring(lt - i * STAGGER)

interface Frame {
  items: { pts: number[]; role: Role; from: Role; q: number; c: [number, number] }[]
  lines: { x1: number; y1: number; x2: number; y2: number; f: number }[]
}

function evalTween(tw: Tween, lt: number): Frame {
  const items = tw.slots.map((s, i) => {
    const p = slotP(i, lt)
    const pts = s.pa.map((v, k) => lerp(v, s.pb[k], p))
    const ca = centre(s.a)
    const cb = centre(s.b)
    return { pts, role: s.b.role, from: s.a.role, q: clamp(p), c: [lerp(ca[0], cb[0], p), lerp(ca[1], cb[1], p)] as [number, number] }
  })
  const lines: Frame["lines"] = []
  for (const l of tw.linksB) {
    const [a, b] = l.s
    const f = l.fresh ? clamp(spring(lt - 0.12, 200, 26, 1)) : 1
    lines.push({ x1: items[a].c[0], y1: items[a].c[1], x2: items[b].c[0], y2: items[b].c[1], f })
  }
  for (const [a, b] of tw.linksA) {
    const f = 1 - clamp(lt / 0.16)
    if (f > 0) lines.push({ x1: items[a].c[0], y1: items[a].c[1], x2: items[b].c[0], y2: items[b].c[1], f })
  }
  return { items, lines }
}

/** Where the morph stands at `lt` — the starting point for the next one, so fast cuts interrupt cleanly. */
function snapshot(tw: Tween, lt: number): G {
  const items: Item[] = []
  const map = new Map<number, number>()
  tw.slots.forEach((s, i) => {
    if (s.dies) return
    const p = slotP(i, lt)
    map.set(i, items.length)
    items.push({
      kind: s.b.kind,
      role: s.b.role,
      x: lerp(s.a.x, s.b.x, p),
      y: lerp(s.a.y, s.b.y, p),
      w: lerp(s.a.w, s.b.w, p),
      h: lerp(s.a.h, s.b.h, p),
      pts: p > 0.995 ? undefined : s.pa.map((v, k) => lerp(v, s.pb[k], p)),
    })
  })
  const links = tw.linksB.map((l) => [map.get(l.s[0])!, map.get(l.s[1])!] as [number, number])
  return { items, links }
}

interface Key {
  t: number
  g: G
  origin?: [number, number]
}

class Track {
  private tweens: Tween[] = []
  constructor(private keys: Key[], private start: G = EMPTY) {}
  private tw(i: number): Tween {
    if (!this.tweens[i]) {
      const from = i === 0 ? this.start : snapshot(this.tw(i - 1), this.keys[i].t - this.keys[i - 1].t)
      this.tweens[i] = tween(from, this.keys[i].g, this.keys[i].origin)
    }
    return this.tweens[i]
  }
  at(t: number): Frame {
    let i = -1
    while (i + 1 < this.keys.length && this.keys[i + 1].t <= t) i++
    if (i < 0) return evalTween(tween(this.start, this.start), 1)
    return evalTween(this.tw(i), t - this.keys[i].t)
  }
}

// —— Drawing glyphs ——————————————————————————————————————————————

const ROLE_ORDER: Record<Role, number> = { fill: 0, outline: 1, ink: 2 }
function roleLook(role: Role) {
  if (role === "fill") return { fill: FILL, fa: 1, sa: 0 }
  if (role === "ink") return { fill: INK, fa: 1, sa: 0 }
  return { fill: FILL, fa: 0, sa: 1 }
}

function pathOf(pts: number[]) {
  let d = `M${r1(pts[0])} ${r1(pts[1])}`
  for (let i = 2; i < pts.length; i += 2) d += `L${r1(pts[i])} ${r1(pts[i + 1])}`
  return d + "Z"
}

/** A glyph frame in glyph units (200 × 100 box), hand-drawn wobble on. */
function drawGlyph(f: Frame, opacity = 1): string {
  let out = `<g filter="url(#wob)"${opacity < 1 ? ` opacity="${opacity}"` : ""}>`
  const order = [...f.items].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
  for (const it of order) {
    const A = roleLook(it.from)
    const B = roleLook(it.role)
    const fa = lerp(A.fa, B.fa, it.q)
    const sa = lerp(A.sa, B.sa, it.q)
    out += `<path d="${pathOf(it.pts)}" fill="${mix(A.fill, B.fill, it.q)}" fill-opacity="${r1(fa * 100) / 100}"`
    out += sa > 0.01 ? ` stroke="${INK}" stroke-opacity="${r1(sa * 100) / 100}" stroke-width="${STROKE}" stroke-linejoin="round"/>` : "/>"
  }
  for (const l of f.lines) {
    if (l.f <= 0.001) continue
    const x2 = lerp(l.x1, l.x2, l.f)
    const y2 = lerp(l.y1, l.y2, l.f)
    out += `<path d="M${r1(l.x1)} ${r1(l.y1)}L${r1(x2)} ${r1(y2)}" stroke="${INK}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>`
    out += `<circle cx="${r1(l.x1)}" cy="${r1(l.y1)}" r="${r1(2.4 * clamp(l.f * 4))}" fill="${INK}"/>`
    if (l.f > 0.9) out += `<circle cx="${r1(l.x2)}" cy="${r1(l.y2)}" r="${r1(2.4 * clamp((l.f - 0.9) * 10))}" fill="${INK}"/>`
  }
  return out + "</g>"
}

// —— Timeline ————————————————————————————————————————————————————

// 1 · Alphabet (0–5)
const [CIRCLE, TRIANGLE, SQUARE] = PRIMITIVES.map((p) => spec(p.spec))
const TRIO = spec({ f: [["circle", 22, 28, 44, 44], ["triangle", 77, 27, 46, 42], ["square", 134, 28, 44, 44]] })

// 2 · Grammar (5–11)
const RELS = [
  { kind: "connect", op: "—", reads: "leads to" },
  { kind: "stack", op: "/", reads: "built on" },
  { kind: "nest", op: "⊂", reads: "part of" },
  { kind: "overlap", op: "×", reads: "shared ground" },
  { kind: "anchor", op: "|", reads: "derives from" },
] as const

// 3 · The pieces (11–17)
const TOOLBAR = L.toolbar
const PRESS = [11.45, 11.85, 12.25]
const RELATE = L.relate
const TOGGLE_OPS = ["—", "/", "⊂", "×", "|"]
const CYCLE = [
  { t: 12.9, op: "—" },
  { t: 13.25, op: "/" },
  { t: 13.6, op: "×" },
  { t: 13.95, op: "⊂" },
]
const PILL = L.pill
const TYPED = "(▲ ⊂ ●) / ■"
const TYPE_T0 = 14.8
const TYPE_DT = 0.095

// 4 · Compounds (17–24)
const RUN = ["Chain", "Branch", "Pillar", "Eclipse", "Lantern", "Function", "Hub", "Context window", "Tool call", "Fan-out", "Pipeline"]
const RUN_T: number[] = []
{
  let t = 17
  for (let i = 0; i < RUN.length; i++) {
    RUN_T.push(t)
    t += 1.0 * 0.84 ** i
  }
}

// 5 · Library (24–30)
const ZOOM_T0 = 24
const ZOOM_T1 = 28.4
const PITCH_X = 232
const PITCH_Y = 132
const WALL_SCALE = L.wall.scale

// —— Camera: world (glyph units) → screen ————————————————————————

interface Cam {
  s: number
  sx: number
  sy: number
}
const CAM_MAIN: Cam = L.main
const CAM_UI: Cam = L.ui

function camAt(t: number): Cam {
  const blend = (a: Cam, b: Cam, q: number): Cam => ({ s: lerp(a.s, b.s, q), sx: lerp(a.sx, b.sx, q), sy: lerp(a.sy, b.sy, q) })
  if (t < 10.9) return CAM_MAIN
  if (t < 16.4) return blend(CAM_MAIN, CAM_UI, easeInOut(clamp((t - 10.9) / 0.6)))
  if (t < ZOOM_T0) return blend(CAM_UI, CAM_MAIN, easeInOut(clamp((t - 16.4) / 0.6)))
  const q = easeInOut(clamp((t - ZOOM_T0) / (ZOOM_T1 - ZOOM_T0)))
  return { s: Math.exp(lerp(Math.log(CAM_MAIN.s), Math.log(WALL_SCALE), q)), sx: CX, sy: lerp(CAM_MAIN.sy, L.wall.sy, q) }
}
const camTransform = (c: Cam) => `translate(${r1(c.sx)} ${r1(c.sy)}) scale(${c.s.toFixed(4)}) translate(-100 -50)`
const toWorld = (c: Cam, x: number, y: number): [number, number] => [(x - c.sx) / c.s + 100, (y - c.sy) / c.s + 50]

// —— The main glyph track ————————————————————————————————————————

/** Close what's open and drop a dangling operator, so a half-typed formula still lays out. */
function repair(src: string): string | null {
  let s = src.trimEnd()
  while (s && "—/⊂×|·,({ ".includes(s[s.length - 1])) s = s.slice(0, -1).trimEnd()
  if (!s) return null
  const stack: string[] = []
  for (const ch of s) {
    if (ch === "(") stack.push(")")
    else if (ch === "{") stack.push("}")
    else if (ch === ")" || ch === "}") stack.pop()
  }
  return s + stack.reverse().join("")
}

function buildMain(): Track {
  const keys: Key[] = [
    { t: 0.25, g: CIRCLE },
    { t: 1.5, g: TRIANGLE },
    { t: 2.7, g: SQUARE },
    { t: 3.9, g: TRIO },
  ]
  RELS.forEach((r, i) => keys.push({ t: 5 + i, g: spec(pairSpec(r.kind, "circle", "square")) }))
  keys.push({ t: 10.95, g: EMPTY })
  const ui = (x: number) => toWorld(CAM_UI, x, TOOLBAR.cy - 20)
  keys.push({ t: PRESS[0] + 0.05, g: formulaG("●"), origin: ui(TOOLBAR.buttons[0]) })
  keys.push({ t: PRESS[1] + 0.05, g: formulaG("● · ▲"), origin: ui(TOOLBAR.buttons[1]) })
  keys.push({ t: PRESS[2] + 0.05, g: formulaG("● · ▲ · ■"), origin: ui(TOOLBAR.buttons[2]) })
  for (const c of CYCLE) keys.push({ t: c.t + 0.05, g: formulaG(`▲ · (● ${c.op} ■)`) })
  let last = ""
  for (let i = 1; i <= TYPED.length; i++) {
    const f = repair(TYPED.slice(0, i))
    if (!f || f === last) continue
    try {
      const g = formulaG(f)
      keys.push({ t: TYPE_T0 + (i - 1) * TYPE_DT + 0.03, g })
      last = f
    } catch {
      /* keep the last glyph that parsed */
    }
  }
  RUN.forEach((name, i) => keys.push({ t: RUN_T[i], g: spec(compound(name).spec) }))
  return new Track(keys)
}
const MAIN = buildMain()

function groundAt(t: number): string {
  if (t < RUN_T[1]) return YELLOW
  let i = 1
  while (i + 1 < RUN_T.length && RUN_T[i + 1] <= t) i++
  const from = PASTELS[(i - 1) % PASTELS.length]
  const to = PASTELS[i % PASTELS.length]
  return mix(from, to, clamp((t - RUN_T[i]) / 0.12))
}
const FINAL_GROUND = PASTELS[(RUN.length - 1) % PASTELS.length]

// —— The wall ————————————————————————————————————————————————————

const POOL: G[] = [
  ...COMPOUNDS.filter((c) => c.name !== "Pipeline").map((c) => spec(c.spec)),
  ...(["connect", "stack", "nest", "overlap", "anchor"] as const).flatMap((r) =>
    (["circle", "triangle", "square"] as const).flatMap((a) => (["circle", "triangle", "square"] as const).map((b) => spec(pairSpec(r, a, b)))),
  ),
  CIRCLE,
  TRIANGLE,
  SQUARE,
]

interface Tile {
  i: number
  j: number
  ground: string
  delay: number
  base: number
  period: number
  phase: number
  tweens: Map<number, Tween>
}
const TILES: Tile[] = []
for (let j = -L.wall.rows; j <= L.wall.rows; j++) {
  for (let i = -L.wall.cols; i <= L.wall.cols; i++) {
    if (i === 0 && j === 0) continue
    const h = hash(i * 31 + j * 17)
    // Compounds near the centre, pairs and primitives towards the edges.
    const d = Math.hypot(i * 1.2, j)
    const base = d < 3.2 ? Math.floor(h * 49) : Math.floor(h * POOL.length)
    TILES.push({
      i,
      j,
      ground: PASTELS[(((i * 3 + j * 5) % 7) + 7) % 7],
      delay: ZOOM_T0 + 0.35 + d * 0.16 + h * 0.08,
      base,
      period: 1.3 + hash(i * 7 - j * 13) * 0.9,
      phase: hash(i * 11 + j * 3) * 1.5,
      tweens: new Map(),
    })
  }
}

function tileFrame(tile: Tile, t: number): Frame {
  const since = t - tile.delay
  const k = Math.max(0, Math.floor((since - tile.phase) / tile.period) + 1)
  const g = (n: number) => POOL[(tile.base + n * 7) % POOL.length]
  if (!tile.tweens.has(k)) tile.tweens.set(k, k === 0 ? tween(g(0), g(0)) : tween(g(k - 1), g(k)))
  const lt = k === 0 ? 1 : since - tile.phase - (k - 1) * tile.period
  return evalTween(tile.tweens.get(k)!, lt)
}

function drawWall(t: number, cam: Cam): string {
  let out = ""
  for (const tile of TILES) {
    const p = spring(t - tile.delay, 260, 22, 1)
    if (p <= 0.001) continue
    const ox = tile.i * PITCH_X
    const oy = tile.j * PITCH_Y
    // Cull tiles that are off-screen.
    const sx = (ox + 100 - 100) * cam.s + cam.sx
    const sy = (oy + 50 - 50) * cam.s + cam.sy
    if (sx < -PITCH_X * cam.s || sx > W + PITCH_X * cam.s || sy < -PITCH_Y * cam.s || sy > H + PITCH_Y * cam.s) continue
    const breathe = 1 + 0.012 * Math.sin((t + tile.phase) * 2.4)
    const s = p * breathe
    out += `<g transform="translate(${ox + 100} ${oy + 50}) scale(${s.toFixed(4)}) translate(-100 -50)">`
    out += `<rect x="-8" y="-8" width="216" height="116" rx="10" fill="${tile.ground}"/>`
    out += drawGlyph(tileFrame(tile, t))
    out += "</g>"
  }
  return out
}

// —— Type and UI pieces ——————————————————————————————————————————

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

interface Caption {
  t0: number
  t1: number
  text: string
  y: number
  size: number
  font?: string
  weight?: number
  color?: string
}

function caption(c: Caption, t: number): string {
  if (t < c.t0 || t > c.t1) return ""
  const a = clamp((t - c.t0) / 0.16) * clamp((c.t1 - t) / 0.12)
  const dy = (1 - spring(t - c.t0, 260, 26, 1)) * 16
  return `<text x="${CX}" y="${r1(c.y + dy)}" text-anchor="middle" font-family="${c.font ?? SANS}" font-size="${c.size}" font-weight="${c.weight ?? 500}" fill="${c.color ?? INK}" opacity="${r1(a * 100) / 100}" letter-spacing="${c.font === MONO ? 0 : -0.5}">${esc(c.text)}</text>`
}

const CAP_Y = L.capY
const FORM_Y = L.formY
const CAPTIONS: Caption[] = [
  { t0: 0.35, t1: 1.45, text: "A signal.", y: CAP_Y, size: L.capSize },
  { t0: 1.6, t1: 2.65, text: "A change.", y: CAP_Y, size: L.capSize },
  { t0: 2.8, t1: 3.85, text: "A structure.", y: CAP_Y, size: L.capSize },
  { t0: 4.0, t1: 4.95, text: "Three shapes.", y: CAP_Y, size: L.capSize, weight: 600 },
  ...RELS.flatMap((r, i): Caption[] => [
    { t0: 5.05 + i, t1: 5.95 + i, text: `● ${r.op} ■`, y: FORM_Y, size: L.formSize, font: MONO, weight: 400 },
    { t0: 5.1 + i, t1: 5.95 + i, text: r.reads, y: CAP_Y, size: L.capSize },
  ]),
  { t0: 10.05, t1: 10.9, text: "—   /   ⊂   ×   |", y: FORM_Y, size: L.formSize, font: MONO, weight: 400 },
  { t0: 10.05, t1: 10.9, text: "Five relations.", y: CAP_Y, size: L.capSize, weight: 600 },
  { t0: 11.15, t1: 12.6, text: "Add shapes.", y: CAP_Y, size: L.capSize },
  { t0: 12.7, t1: 14.35, text: "Relate them.", y: CAP_Y, size: L.capSize },
  { t0: 14.5, t1: 16.75, text: "Or write it.", y: CAP_Y, size: L.capSize },
  ...RUN.flatMap((name, i): Caption[] => {
    const t1 = i + 1 < RUN.length ? RUN_T[i + 1] - 0.01 : 23.9
    return [
      { t0: RUN_T[i] + 0.02, t1, text: compound(name).formula, y: FORM_Y, size: L.formSize, font: MONO, weight: 400 },
      { t0: RUN_T[i] + 0.02, t1: i + 1 < RUN.length ? t1 : 22.85, text: name, y: CAP_Y, size: L.capSize, weight: 600 },
    ]
  }),
  { t0: 22.95, t1: 23.9, text: "Every idea, three shapes.", y: CAP_Y, size: L.capSize, weight: 600 },
]

function card(x: number, y: number, w: number, h: number, r: number, inner: string, opacity = 1) {
  return `<g opacity="${r1(opacity * 100) / 100}"><rect x="${r1(x)}" y="${r1(y)}" width="${w}" height="${h}" rx="${r}" fill="#FFFFFF" stroke="${BORDER}" stroke-width="1.5" filter="url(#shadow)"/>${inner}</g>`
}

function shapeIcon(kind: Kind, cx: number, cy: number, size: number, filled = false) {
  const s = size
  const d =
    kind === "circle"
      ? `M${cx - s / 2} ${cy}a${s / 2} ${s / 2} 0 1 0 ${s} 0a${s / 2} ${s / 2} 0 1 0 ${-s} 0Z`
      : kind === "square"
        ? `M${cx - s / 2} ${cy - s / 2}h${s}v${s}h${-s}Z`
        : `M${cx} ${cy - s / 2}L${cx + s / 2} ${cy + s * 0.42}L${cx - s / 2} ${cy + s * 0.42}Z`
  return `<path d="${d}" fill="${filled ? INK : "none"}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
}

function drawToolbar(t: number) {
  if (t < 11 || t > 13.4) return ""
  const inP = spring(t - 11.0, 260, 24, 1)
  const outP = spring(t - 12.75, 260, 24, 1)
  const dy = (1 - inP) * 220 + outP * 240
  const { cx, cy, w, h, buttons } = TOOLBAR
  let inner = ""
  const kinds: Kind[] = ["circle", "triangle", "square"]
  buttons.forEach((bx, i) => {
    const since = t - PRESS[i]
    const pressed = since > 0 && since < 0.22
    const k = pressed ? 0.86 + 0.14 * clamp(since / 0.22) ** 2 : 1
    if (pressed || (since > 0 && since < 0.4)) inner += `<rect x="${bx - 34}" y="${cy - 34 + dy}" width="68" height="68" rx="14" fill="#F0F0F0" opacity="${r1(clamp(1 - (since - 0.22) / 0.18) * 100) / 100}"/>`
    inner += `<g transform="translate(${bx} ${cy + dy}) scale(${k}) translate(${-bx} ${-cy})">${shapeIcon(kinds[i], bx, cy, 30)}</g>`
  })
  return card(cx - w / 2, cy - h / 2 + dy, w, h, 18, inner, 1 - clamp(outP))
}

function drawRelate(t: number) {
  if (t < 12.45 || t > 15.2) return ""
  const inP = spring(t - 12.45, 240, 24, 1)
  const outP = spring(t - 14.35, 240, 24, 1)
  const { x: X, y: Y0, w, h, from } = RELATE
  const x = X + (1 - inP) * from[0] + outP * (from[0] * 1.1)
  const Y = Y0 + (1 - inP) * from[1] + outP * (from[1] * 1.1)
  let inner = `<text x="${x + 28}" y="${Y + 50}" font-family="${SANS}" font-size="22" font-weight="600" fill="${INK}">Relate</text>`
  const chip = (cy: number, letter: string, kind: Kind, name: string) =>
    `<text x="${x + 28}" y="${cy + 8}" font-family="${SANS}" font-size="20" font-weight="600" fill="${MUTED}">${letter}</text>` +
    `<rect x="${x + 64}" y="${cy - 26}" width="${w - 92}" height="52" rx="12" fill="#FFFFFF" stroke="${BORDER}" stroke-width="1.5"/>` +
    shapeIcon(kind, x + 96, cy, 20, true) +
    `<text x="${x + 122}" y="${cy + 8}" font-family="${SANS}" font-size="22" font-weight="500" fill="${INK}">${name}</text>`
  inner += chip(Y + 104, "A", "circle", "Circle")
  inner += chip(Y + 274, "B", "square", "Square")
  // Relation toggle: the active segment slides between ops.
  const ty = Y + 160
  const tx = x + 28
  const tw = w - 56
  const seg = tw / TOGGLE_OPS.length
  let idx = 0
  let prev = 0
  let since = 0
  for (const c of CYCLE) {
    if (t >= c.t) {
      prev = idx
      idx = TOGGLE_OPS.indexOf(c.op)
      since = t - c.t
    }
  }
  const pos = t < CYCLE[0].t ? -1 : lerp(prev, idx, spring(since, 380, 28, 0.8))
  inner += `<rect x="${tx}" y="${ty}" width="${tw}" height="60" rx="14" fill="#F5F5F5"/>`
  if (pos >= 0) inner += `<rect x="${r1(tx + 4 + pos * seg)}" y="${ty + 4}" width="${r1(seg - 8)}" height="52" rx="11" fill="${INK}"/>`
  TOGGLE_OPS.forEach((op, i) => {
    const on = pos >= 0 && Math.abs(pos - i) < 0.5
    inner += `<text x="${r1(tx + seg * (i + 0.5))}" y="${ty + 41}" text-anchor="middle" font-family="${MONO}" font-size="28" fill="${on ? "#FFFFFF" : MUTED}">${esc(op)}</text>`
  })
  return card(x, Y, w, h, 18, inner)
}

function drawPill(t: number) {
  if (t < 14.25 || t > 17.2) return ""
  const inP = spring(t - 14.25, 240, 24, 1)
  const outP = spring(t - 16.45, 240, 24, 1)
  const dy = -(1 - inP) * 240 - outP * 260
  const { cx, cy, w, h } = PILL
  const x = cx - w / 2
  const y = cy - h / 2 + dy
  const before = "▲ · (● ⊂ ■)"
  const selected = t >= 14.6 && t < TYPE_T0
  const typed = t < 14.6 ? before : t < TYPE_T0 ? before : TYPED.slice(0, clamp(Math.floor((t - TYPE_T0) / TYPE_DT) + 1, 0, TYPED.length))
  const size = 36
  const cw = size * 0.602
  const textW = typed.length * cw
  const tx = cx - (TYPED.length * cw) / 2
  const ok = t >= 16.0
  let inner = ""
  if (selected) inner += `<rect x="${r1(tx - 4)}" y="${r1(y + 20)}" width="${r1(textW + 8)}" height="${h - 40}" rx="6" fill="${SELECTION}" opacity="0.22"/>`
  inner += `<text x="${r1(tx)}" y="${r1(y + h / 2 + 12)}" font-family="${MONO}" font-size="${size}" fill="${INK}" xml:space="preserve">${esc(typed)}</text>`
  const blink = t >= TYPE_T0 && t < 16.0 ? Math.floor((t - TYPE_T0) * 4) % 2 === 0 || t < TYPE_T0 + TYPED.length * TYPE_DT : false
  if (blink) inner += `<rect x="${r1(tx + textW + 3)}" y="${r1(y + 22)}" width="3" height="${h - 44}" fill="${SELECTION}"/>`
  // Rule check: a dot that turns green once the formula is complete.
  inner += `<circle cx="${x + w - 40}" cy="${r1(y + h / 2)}" r="9" fill="${ok ? "#22C55E" : "#D4D4D4"}"/>`
  inner += `<text x="${x + 32}" y="${r1(y + h / 2 + 8)}" font-family="${SANS}" font-size="22" font-weight="600" fill="${MUTED}">ƒ</text>`
  return card(x, y, w, h, 20, inner)
}

function drawEndCard(t: number) {
  if (t < 27.3) return ""
  const a = easeOut(clamp((t - 27.3) / 0.9))
  let out = `<rect width="${W}" height="${H}" fill="#FFFFFF" opacity="${r1(a * 62) / 100}"/>`
  out += `<ellipse cx="${CX}" cy="${H / 2}" rx="${VERTICAL ? 540 : 760}" ry="${VERTICAL ? 480 : 300}" fill="url(#halo)" opacity="${r1(a * 100) / 100}"/>`
  const line = (t0: number, y: number, text: string, size: number, weight: number, font = SANS, color = INK) => {
    const p = spring(t - t0, 220, 24, 1)
    if (p <= 0) return ""
    return `<text x="${CX}" y="${r1(y + (1 - p) * 30)}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" opacity="${r1(clamp(p) * 100) / 100}" letter-spacing="${font === SANS ? -size * 0.025 : 0}">${esc(text)}</text>`
  }
  // The three primitives as a mark above the name.
  const mp = spring(t - 27.55, 260, 20, 1)
  if (mp > 0) {
    out += `<g transform="translate(${CX} ${VERTICAL ? 700 : 392}) scale(${r1(mp * 100) / 100})">`
    out += `<circle cx="-62" cy="0" r="22" fill="${INK}"/>`
    out += `<path d="M0 -24L26 20L-26 20Z" fill="${INK}"/>`
    out += `<rect x="40" y="-22" width="44" height="44" fill="${INK}"/>`
    out += "</g>"
  }
  if (VERTICAL) {
    out += line(27.7, 900, "Glyph System", 128, 700)
    out += line(27.78, 1030, "Studio", 128, 700)
    out += line(27.9, 1120, "Three shapes. Five relations.", 50, 500, SANS, MUTED)
    out += line(28.1, 1200, "glyph-system-studio.netlify.app", 32, 400, MONO, INK)
  } else {
    out += line(27.7, 538, "Glyph System Studio", 112, 700)
    out += line(27.9, 612, "Three shapes. Five relations.", 44, 500, SANS, MUTED)
    out += line(28.1, 690, "glyph-system-studio.netlify.app", 28, 400, MONO, INK)
  }
  return out
}

// —— Frame ———————————————————————————————————————————————————————

const DEFS = `<defs>
<filter id="wob" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${WOBBLE}"/></filter>
<radialGradient id="halo"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0.8"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<filter id="shadow" x="-20%" y="-30%" width="140%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000" flood-opacity="0.10"/></filter>
</defs>`

export function frame(t: number): string {
  const cam = camAt(t)
  const zooming = t >= ZOOM_T0
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}`
  svg += `<rect width="${W}" height="${H}" fill="${zooming ? WORKSPACE : groundAt(t)}"/>`
  svg += `<g transform="${camTransform(cam)}">`
  if (zooming) {
    // The last glyph's ground shrinks from full screen into its tile as the wall comes in.
    const q = easeInOut(clamp((t - ZOOM_T0) / 1.1))
    const [x0, y0] = toWorld(cam, -4, -4)
    const [x1, y1] = toWorld(cam, W + 4, H + 4)
    svg += drawWall(t, cam)
    svg += `<rect x="${r1(lerp(x0, -8, q))}" y="${r1(lerp(y0, -8, q))}" width="${r1(lerp(x1 - x0, 216, q))}" height="${r1(lerp(y1 - y0, 116, q))}" rx="${r1(10 * q)}" fill="${FINAL_GROUND}"/>`
  }
  svg += drawGlyph(MAIN.at(t))
  svg += "</g>"
  svg += drawToolbar(t) + drawRelate(t) + drawPill(t)
  if (!NO_CAPTIONS) for (const c of CAPTIONS) svg += caption(c, t)
  svg += drawEndCard(t)
  return svg + "</svg>"
}

// —— Page hooks ——————————————————————————————————————————————————

const stage = document.getElementById("stage")!
let now = 0
function seek(t: number) {
  now = clamp(t, 0, DURATION)
  stage.innerHTML = frame(now)
}
declare global {
  interface Window {
    seek: (t: number) => void
    film: { duration: number }
  }
}
window.seek = seek
window.film = { duration: DURATION }

const params = new URLSearchParams(location.search)
seek(Number(params.get("t") ?? 0))
if (!params.has("render")) {
  let playing = false
  let last = 0
  const loop = (ms: number) => {
    if (!playing) return
    seek(now + (ms - last) / 1000)
    last = ms
    if (now < DURATION) requestAnimationFrame(loop)
  }
  addEventListener("keydown", (e) => {
    if (e.key === " ") {
      playing = !playing
      last = performance.now()
      if (playing) requestAnimationFrame(loop)
    }
    if (e.key === "ArrowRight") seek(now + 1 / 30)
    if (e.key === "ArrowLeft") seek(now - 1 / 30)
  })
}

import { BOX_H, BOX_W, center, formula, shapePath, toSpec, type Doc, type Shape } from "./grammar"
import type { Style } from "./presets"

const NODE_R = 2.4

const pathsFor = (shapes: Shape[]) => shapes.map((s) => shapePath(s.kind, s.x, s.y, s.w, s.h)).join("")

/** Standalone SVG of the glyph on its ground, sized `scale` px per glyph unit. */
export function toSVG(doc: Doc, style: Style, scale = 4): string {
  const filter = style.wobble > 0 ? wobbleFilter(style.wobble, `seed="${style.seed}"`) : ""
  return svgMarkup(doc, style, scale, filter)
}

// —— Animation: the hand-drawn line "boils", stepping through noise seeds ——

/** Frames in one loop, and how long each holds — about 10 fps, like hand-drawn animation. */
const BOIL_FRAMES = 8
const BOIL_FRAME_MS = 100
/** A glyph drawn without wobble still needs some to boil. */
const BOIL_MIN_WOBBLE = 2

const boilWobble = (style: Style) => Math.max(style.wobble, BOIL_MIN_WOBBLE)
const boilSeeds = (style: Style) => Array.from({ length: BOIL_FRAMES }, (_, i) => style.seed + i)

/** SVG whose wobble loops forever, animated with SMIL — no script, plays in browsers and <img>. */
export function toAnimatedSVG(doc: Doc, style: Style, scale = 4): string {
  const seeds = boilSeeds(style)
  const animate = `<animate attributeName="seed" values="${seeds.join(";")}" dur="${(BOIL_FRAMES * BOIL_FRAME_MS) / 1000}s" calcMode="discrete" repeatCount="indefinite"/>`
  return svgMarkup(doc, style, scale, wobbleFilter(boilWobble(style), `seed="${style.seed}"`, animate))
}

/** Looping GIF of the same boil, rendered frame by frame from the SVG. */
export function toGIF(doc: Doc, style: Style, scale = 3): Promise<Blob> {
  const frames = boilSeeds(style).map((seed) => ({
    svg: toSVG(doc, { ...style, wobble: boilWobble(style), seed }, scale),
    ms: BOIL_FRAME_MS,
  }))
  return encodeGIF(frames, scale)
}

// —— With entrance: the glyph enters as it does on the canvas, then boils ——
// Shapes fade in and grow from 40%, lines draw on, nodes pop — on the canvas's spring.

/** The canvas's spring (stiffness 420, damping 32, mass 0.8), from 0 at rest to 1. */
function spring(t: number): number {
  const w0 = Math.sqrt(420 / 0.8)
  const zeta = 32 / (2 * Math.sqrt(420 * 0.8))
  const wd = w0 * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
}

/** The spring has settled by then. */
const ENTER_S = 0.4
/** How long the GIF boils before its loop plays the entrance again. */
const GIF_HOLD_S = 2.4

const seedAt = (style: Style, t: number) => style.seed + (Math.floor((t * 1000) / BOIL_FRAME_MS + 1e-6) % BOIL_FRAMES)

// The canvas's enter values, as functions of q = spring progress (0 gone, 1 there).
type Channel = (q: number) => number
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const shapeOpacity: Channel = (q) => clamp01(q)
const shapeScale: Channel = (q) => 0.4 + 0.6 * q
const lineOffset: Channel = (q) => 1 - clamp01(q) // dash offset on a pathLength="1" line
const lineOpacity: Channel = (q) => clamp01(q * 20) // hides the round cap's dot before drawing starts
const nodeScale: Channel = (q) => Math.max(0, q)

const num = (n: number) => String(+n.toFixed(3))

/** Either a still frame at time `at`, or SMIL that plays the entrance once and holds. */
function animator(at?: number) {
  const times: number[] = []
  for (let t = 0; t <= ENTER_S + 1e-9; t += 0.02) times.push(t)
  const timing = `keyTimes="${times.map((t) => num(t / ENTER_S)).join(";")}" dur="${ENTER_S}s" fill="freeze"`
  const values = (ch: Channel) => times.map((t) => num(ch(spring(t)))).join(";")
  const still = (ch: Channel) => num(ch(at! < ENTER_S ? spring(at!) : 1))
  const animating = at === undefined

  return {
    /** Attributes for a still frame (empty when animating). */
    attr: (name: string, ch: Channel) => (animating ? "" : ` ${name}="${still(ch)}"`),
    scaleAttr: (ch: Channel) => (animating ? "" : ` transform="scale(${still(ch)})"`),
    /** SMIL children (empty for a still frame). */
    anim: (name: string, ch: Channel) => (animating ? `<animate attributeName="${name}" values="${values(ch)}" ${timing}/>` : ""),
    scaleAnim: (ch: Channel) =>
      animating ? `<animateTransform attributeName="transform" type="scale" values="${values(ch)}" ${timing}/>` : "",
  }
}

/** The glyph with every element animatable around its own centre, like the canvas's. */
function entranceMarkup(doc: Doc, style: Style, scale: number, at?: number): string {
  const a = animator(at)
  const seeds = boilSeeds(style)
  const seedAnim =
    at === undefined
      ? `<animate attributeName="seed" values="${seeds.join(";")}" dur="${(BOIL_FRAMES * BOIL_FRAME_MS) / 1000}s" calcMode="discrete" repeatCount="indefinite"/>`
      : ""
  const filter = wobbleFilter(boilWobble(style), `seed="${seedAt(style, at ?? 0)}"`, seedAnim)

  // Scale about (cx, cy): move there, scale, draw the element relative to it.
  const popping = (cx: number, cy: number, ch: Channel, extra: string, el: string) =>
    `<g transform="translate(${num(cx)} ${num(cy)})"><g${a.scaleAttr(ch)}${extra}>${a.scaleAnim(ch)}${el}</g></g>`

  const paint = {
    fill: `fill="${style.fill}"`,
    outline: `fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linejoin="round"`,
    ink: `fill="${style.ink}"`,
  }
  const shapes = (["fill", "outline", "ink"] as const)
    .flatMap((role) => doc.shapes.filter((s) => s.role === role))
    .map((s) => {
      const cx = s.x + s.w / 2
      const cy = s.y + s.h / 2
      const d = shapePath(s.kind, s.x - cx, s.y - cy, s.w, s.h)
      return popping(cx, cy, shapeScale, a.attr("opacity", shapeOpacity), `${a.anim("opacity", shapeOpacity)}<path d="${d}" ${paint[s.role]}/>`)
    })
    .join("")

  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  let lines = ""
  let nodes = ""
  for (const l of doc.links) {
    const sa = byId.get(l.a)
    const sb = byId.get(l.b)
    if (!sa || !sb) continue
    const [x1, y1] = center(sa)
    const [x2, y2] = center(sb)
    lines +=
      `<path d="M${x1} ${y1}L${x2} ${y2}" pathLength="1" stroke-dasharray="1 1"${a.attr("stroke-dashoffset", lineOffset)}${a.attr("opacity", lineOpacity)}>` +
      `${a.anim("stroke-dashoffset", lineOffset)}${a.anim("opacity", lineOpacity)}</path>`
    for (const [cx, cy] of [
      [x1, y1],
      [x2, y2],
    ])
      nodes += popping(cx, cy, nodeScale, "", `<circle r="${NODE_R}"/>`)
  }

  const W = BOX_W + PAD * 2
  const H = BOX_H + PAD * 2
  const title = formula(doc)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${W} ${H}" width="${W * scale}" height="${H * scale}">`,
    title ? `<title>${title}</title>` : "",
    filter,
    `<rect x="${-PAD}" y="${-PAD}" width="${W}" height="${H}" fill="${style.ground}"/>`,
    `<g filter="url(#w)">`,
    shapes,
    lines && `<g fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linecap="round">${lines}</g>`,
    nodes && `<g fill="${style.ink}">${nodes}</g>`,
    `</g></svg>`,
  ].join("")
}

/** SVG that plays the canvas's entrance once, then boils forever (SMIL, no script). */
export function toEntranceSVG(doc: Doc, style: Style, scale = 4): string {
  return entranceMarkup(doc, style, scale)
}

/** GIF of the entrance, then the boil; GIFs loop whole, so each loop enters again. */
export function toEntranceGIF(doc: Doc, style: Style, scale = 3): Promise<Blob> {
  const frames: { svg: string; ms: number }[] = []
  for (let t = 0; t < ENTER_S - 1e-9; t += 0.04) frames.push({ svg: entranceMarkup(doc, style, scale, t), ms: 40 })
  for (let t = ENTER_S; t < ENTER_S + GIF_HOLD_S - 1e-9; t += BOIL_FRAME_MS / 1000)
    frames.push({ svg: entranceMarkup(doc, style, scale, t), ms: BOIL_FRAME_MS })
  return encodeGIF(frames, scale)
}

async function encodeGIF(frames: { svg: string; ms: number }[], scale: number): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc")
  const width = (BOX_W + PAD * 2) * scale
  const height = (BOX_H + PAD * 2) * scale
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas is unavailable")

  const gif = GIFEncoder()
  for (const { svg, ms } of frames) {
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(await loadImage(svg), 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    const palette = quantize(data, 256)
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: ms })
  }
  gif.finish()
  return new Blob([gif.bytes()], { type: "image/gif" })
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't render the glyph"))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

// —— SVG markup ————————————————————————————————————————————————————

const PAD = 12

function wobbleFilter(wobble: number, seed: string, animate = ""): string {
  return `<defs><filter id="w" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" ${seed}>${animate}</feTurbulence><feDisplacementMap in="SourceGraphic" scale="${wobble}"/></filter></defs>`
}

function svgMarkup(doc: Doc, style: Style, scale: number, filter: string): string {
  const pad = PAD
  const vb = `${-pad} ${-pad} ${BOX_W + pad * 2} ${BOX_H + pad * 2}`
  const fill = pathsFor(doc.shapes.filter((s) => s.role === "fill"))
  const outline = pathsFor(doc.shapes.filter((s) => s.role === "outline"))
  const ink = pathsFor(doc.shapes.filter((s) => s.role === "ink"))
  const byId = new Map(doc.shapes.map((s) => [s.id, s]))
  let lines = ""
  let nodes = ""
  for (const l of doc.links) {
    const a = byId.get(l.a)
    const b = byId.get(l.b)
    if (!a || !b) continue
    const [x1, y1] = center(a)
    const [x2, y2] = center(b)
    lines += `M${x1} ${y1}L${x2} ${y2}`
    nodes += `<circle cx="${x1}" cy="${y1}" r="${NODE_R}"/><circle cx="${x2}" cy="${y2}" r="${NODE_R}"/>`
  }
  const title = formula(doc)
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${(BOX_W + pad * 2) * scale}" height="${(BOX_H + pad * 2) * scale}">`,
    title ? `<title>${title}</title>` : "",
    filter,
    `<rect x="${-pad}" y="${-pad}" width="${BOX_W + pad * 2}" height="${BOX_H + pad * 2}" fill="${style.ground}"/>`,
    `<g${filter ? ' filter="url(#w)"' : ""}>`,
    fill && `<path d="${fill}" fill="${style.fill}"/>`,
    outline && `<path d="${outline}" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linejoin="round"/>`,
    ink && `<path d="${ink}" fill="${style.ink}"/>`,
    lines && `<path d="${lines}" fill="none" stroke="${style.ink}" stroke-width="${style.stroke}" stroke-linecap="round"/>`,
    nodes && `<g fill="${style.ink}">${nodes}</g>`,
    `</g></svg>`,
  ].join("")
}

/** An entry for the portfolio's `src/content/glyphs.ts`. */
export function toSnippet(doc: Doc, slug = "your-post-slug"): string {
  const spec = toSpec(doc)
  const lines = Object.entries(spec).map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`)
  return [
    `"${slug}": {`,
    `  formula: ${JSON.stringify(formula(doc).replace(/ {2}· {2}/g, ", "))},`,
    `  reading: "",`,
    `  spec: {`,
    ...lines,
    `  },`,
    `},`,
  ].join("\n")
}

/** A file name from the glyph's title: "Sun over sea" → "sun-over-sea". */
export function fileBase(title: string | undefined): string {
  const slug = (title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "glyph"
}

export function download(filename: string, content: string | Blob, type: string) {
  const url = URL.createObjectURL(typeof content === "string" ? new Blob([content], { type }) : content)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// —— Shareable state in the URL hash ——————————————————————————————

interface Shared {
  doc: Doc
  style: Style
}

export function encodeState(state: Shared): string {
  const json = JSON.stringify(state)
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function decodeState(hash: string): Shared | null {
  try {
    const raw = hash.replace(/^#g=/, "").replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Shared
    if (!Array.isArray(parsed?.doc?.shapes) || !Array.isArray(parsed?.doc?.links) || !parsed.style) return null
    return parsed
  } catch {
    return null
  }
}
